const express = require('express');
const { GoogleAuth } = require('google-auth-library');
const { google } = require('googleapis');

const app = express();
const port = process.env.PORT || 8080;

const zone = process.env.FUNCTION_REGION ? `${process.env.FUNCTION_REGION}-b` : 'us-central1-b';

const auth = new GoogleAuth({
    scopes: ['https://www.googleapis.com/auth/cloud-platform']
});

app.get('/', async (req, res) => {
    const projectId = req.query.projectId;

    if (!projectId) {
        return res.status(400).send('Error: projectId query parameter is required');
    }

    try {
        const compute = google.compute({ version: 'v1', auth });

        const machineType = `zones/${zone}/machineTypes/n1-standard-1`;
        const sourceImage = 'projects/debian-cloud/global/images/family/debian-10';
        const networkName = 'global/networks/default';

        const instanceName = `vm-${Date.now()}`;

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
        const [response] = await compute.instances.insert({
            project: projectId,
            zone,
            requestBody,
        });

        console.log(`Operation ${response.name} started...`);

        // Wait for the operation to complete
        await waitForOperation(compute, projectId, zone, response.name);

        // Get the instance details
        const [instance] = await compute.instances.get({
            project: projectId,
            zone,
            instance: instanceName,
        });

        const ipAddress = instance.data.networkInterfaces[0].accessConfigs[0].natIP;

        res.send(`VM created successfully in project ${projectId}. IP Address: ${ipAddress}`);
    } catch (error) {
        console.error('Error:', error);
        res.status(500).send(`Error creating VM: ${error.message}`);
    }
});

async function waitForOperation(compute, project, zone, operation) {
    while (true) {
        const [response] = await compute.zoneOperations.get({
            project,
            zone,
            operation,
        });

        if (response.status === 'DONE') {
            if (response.error) {
                throw new Error(JSON.stringify(response.error));
            }
            break;
        }

        await new Promise(resolve => setTimeout(resolve, 1000));
    }
}

app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});