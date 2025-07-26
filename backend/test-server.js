const express = require('express');
const app = express();

app.get('/', (req, res) => {
  res.json({ message: 'Test Server läuft!' });
});

app.listen(5001, () => {
  console.log('Test Server läuft auf Port 5001');
});