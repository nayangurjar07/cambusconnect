import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// Backend logic plugin to serve Google Maps configuration securely
function backendMapsPlugin() {
  let runtimeKey = process.env.GOOGLE_MAPS_API_KEY || "AIzaSyD3wNXys4eqg27fxQr-BpzOuALppTDbjPs";

  return {
    name: 'backend-maps-api',
    configureServer(server) {
      server.middlewares.use('/api/maps-config', (req, res) => {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

        if (req.method === 'OPTIONS') {
          res.statusCode = 204;
          return res.end();
        }

        if (req.method === 'GET') {
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({
            success: true,
            apiKey: runtimeKey,
            provider: 'google_maps',
            libraries: ['geometry'],
            source: 'backend_server'
          }));
          return;
        }

        if (req.method === 'POST') {
          let body = '';
          req.on('data', chunk => { body += chunk; });
          req.on('end', () => {
            try {
              const data = JSON.parse(body || '{}');
              if (data.apiKey && typeof data.apiKey === 'string') {
                runtimeKey = data.apiKey.trim();
              }
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({
                success: true,
                message: 'Google Maps API key saved in backend logic successfully',
                source: 'backend_server'
              }));
            } catch (e) {
              res.statusCode = 400;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ error: 'Invalid payload' }));
            }
          });
          return;
        }

        res.statusCode = 405;
        res.end();
      });
    }
  };
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    backendMapsPlugin(),
  ],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
});
