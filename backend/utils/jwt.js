const jwt = require('jsonwebtoken');

const generateToken = (payload) => {
  return jwt.sign(payload, process.env.JWT_SECRET, { 
    expiresIn: '7d' 
  });
};

const generateResetToken = () => {
  return require('crypto').randomBytes(32).toString('hex');
};

module.exports = { generateToken, generateResetToken };