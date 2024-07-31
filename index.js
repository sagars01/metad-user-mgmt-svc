const express = require('express');
const { GoogleAuth } = require('google-auth-library');
const { google } = require('googleapis');

const app = express();
const port = process.env.PORT || 8080;

const zone = process.env.FUNCTION_REGION ? `${process.env.FUNCTION_REGION}-b` : 'us-east1';

const auth = new GoogleAuth({
    scopes: ['https://www.googleapis.com/auth/cloud-platform']
});

async function createVM(projectId, instanceName) {
    const compute = google.compute({ version: 'v1', auth });

    const machineType = `zones/${zone}/machineTypes/n1-standard-1`;
    const sourceImage = 'projects/debian-cloud/global/images/family/debian-11';
    const networkName = 'global/networks/default';

    const requestBody = {
        name: instanceName,
        machineType,
        disks: [
            {
                boot: true,
                autoDelete: true,
                initializeParams: {
                    sourceImage,
                },
            },
        ],
        networkInterfaces: [
            {
                network: networkName,
                accessConfigs: [
                    {
                        name: 'External NAT',
                        type: 'ONE_TO_ONE_NAT',
                    },
                ],
            },
        ],
    };

    console.log(`Creating instance ${instanceName} in ${zone} for project ${projectId}...`);

    try {
        const [operation] = await compute.instances.insert({
            project: projectId,
            zone,
            requestBody,
        });

        console.log(`Operation ${operation.name} started...`);

        await waitForOperation(compute, projectId, zone, operation.name);

        const [instance] = await compute.instances.get({
            project: projectId,
            zone,
            instance: instanceName,
        });

        const ipAddress = instance.networkInterfaces[0].accessConfigs[0].natIP;
        console.log(`VM created successfully. IP Address: ${ipAddress}`);
        return ipAddress;
    } catch (error) {
        console.error('Error in createVM:', error);
        throw error;
    }
}

async function waitForOperation(compute, project, zone, operationName) {
    while (true) {
        try {
            const [operation] = await compute.zoneOperations.get({
                project,
                zone,
                operation: operationName,
            });

            if (operation.status === 'DONE') {
                if (operation.error) {
                    throw new Error(`Operation failed: ${JSON.stringify(operation.error)}`);
                }
                return;
            }

            await new Promise(resolve => setTimeout(resolve, 1000));
        } catch (error) {
            console.error('Error in waitForOperation:', error);
            throw error;
        }
    }
}

app.get('/', async (req, res) => {
    const projectId = req.query.projectId;

    if (!projectId) {
        console.error('Missing projectId in request');
        return res.status(400).send('Error: projectId query parameter is required');
    }

    const instanceName = `vm-${Date.now()}`;

    try {
        const ipAddress = await createVM(projectId, instanceName);
        res.send(`VM created successfully in project ${projectId}. IP Address: ${ipAddress}`);
    } catch (error) {
        console.error('Error handling request:', error);
        res.status(500).send(`Error creating VM: ${error.message}`);
    }
});

app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});