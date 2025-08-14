module.exports = {
  apps: [{
    name: 'fulfillment-backend',
    script: './backend/server.js',
    cwd: '/var/www/fulfillment-portal',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production',
      PORT: 5000
    }
  }]
};
