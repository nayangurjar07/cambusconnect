import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// Backend logic plugin to serve Google Maps configuration during local Vite development
// Security: Sourced strictly from environment variables without hardcoded fallback credentials
function backendMapsPlugin(env = {}) {
  let runtimeKey = env.GOOGLE_MAPS_API_KEY || env.VITE_GOOGLE_MAPS_API_KEY || process.env.GOOGLE_MAPS_API_KEY || process.env.VITE_GOOGLE_MAPS_API_KEY || "";

  return {
    name: 'backend-maps-api',
    configureServer(server) {
      server.middlewares.use('/api/maps-config', (req, res) => {
        const origin = req.headers.origin || req.headers.host || '';
        if (origin) {
          res.setHeader('Access-Control-Allow-Origin', origin);
        }
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

        if (req.method === 'OPTIONS') {
          res.statusCode = 204;
          return res.end();
        }

        if (req.method === 'GET') {
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({
            success: Boolean(runtimeKey),
            apiKey: runtimeKey,
            provider: 'google_maps',
            libraries: ['geometry'],
            source: 'vite_dev_server'
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
                const trimmed = data.apiKey.trim();
                if (/^AIza[0-9A-Za-z-_]{35}$/.test(trimmed)) {
                  runtimeKey = trimmed;
                } else {
                  res.statusCode = 400;
                  res.setHeader('Content-Type', 'application/json');
                  return res.end(JSON.stringify({ error: 'Invalid Google Maps API key format' }));
                }
              } else if (data.apiKey === '') {
                runtimeKey = process.env.GOOGLE_MAPS_API_KEY || process.env.VITE_GOOGLE_MAPS_API_KEY || "";
              }
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({
                success: true,
                message: 'Google Maps API key saved in development server logic successfully',
                source: 'vite_dev_server'
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
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  return {
    plugins: [
      react(),
      tailwindcss(),
      backendMapsPlugin(env),
    ],
    build: {
      sourcemap: false,
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes('node_modules')) {
              if (id.includes('react') || id.includes('react-dom') || id.includes('react-router')) {
                return 'vendor-react';
              }
              if (id.includes('firebase')) {
                return 'vendor-firebase';
              }
              if (id.includes('lucide-react')) {
                return 'vendor-icons';
              }
              if (id.includes('html5-qrcode') || id.includes('jsqr') || id.includes('pngjs') || id.includes('qrcode')) {
                return 'vendor-scanner';
              }
              return 'vendor-utils';
            }
          },
        },
      },
      chunkSizeWarningLimit: 600,
    },
    oxc: {
      drop: mode === 'production' ? ['console', 'debugger'] : [],
    },
    server: {
      port: 5173,
      proxy: {
        '/api': {
          target: 'http://localhost:3000',
          changeOrigin: true,
        },
      },
    },
  };
});
