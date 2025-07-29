// 1. Erweitere deine setupProxy.js mit Debug-Logs:

const { createProxyMiddleware } = require('http-proxy-middleware');

module.exports = function(app) {
  console.log('🔧 setupProxy.js wird geladen...');
  
  app.use(
    '/api',
    createProxyMiddleware({
      target: 'http://localhost:5000',
      changeOrigin: true,
      logLevel: 'debug',
      onProxyReq: (proxyReq, req, res) => {
        console.log('🔄 Proxy Request:', req.method, req.url, '→', 'http://localhost:5000' + req.url);
      },
      onProxyRes: (proxyRes, req, res) => {
        console.log('📡 Proxy Response:', proxyRes.statusCode, req.url);
      },
      onError: (err, req, res) => {
        console.error('❌ Proxy Error:', err.message, req.url);
      }
    })
  );
  
  console.log('✅ Proxy für /api → http://localhost:5000 konfiguriert');
};