const express = require('express');
const path = require('path');
const app = express();

app.use(express.static(__dirname));

app.listen(3000, () => {
  console.log('Test-Frontend läuft auf http://localhost:3000');
  console.log('Öffne http://localhost:3000/test-api.html');
});