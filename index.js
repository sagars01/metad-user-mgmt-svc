const express = require('express');
const bodyParser = require('body-parser');

const app = express();
app.use(bodyParser.json());

app.post('/register', (req, res) => {
    res.status(201).send({ message: 'User registered successfully' });
});

app.put('/update/:username', (req, res) => {
    res.send({ message: `User ${req.params.username} updated successfully` });
});

app.delete('/delete/:username', (req, res) => {
    res.status(204).send({ message: `User ${req.params.username} deleted successfully` });
});

app.get('/users', (req, res) => {
    res.send([{ username: 'dummyuser' }]);
});

const port = process.env.PORT || 8080;
app.listen(port, () => {
    console.log(`UserManagement Service running on port ${port}`);
});
