import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig({ plugins: [react(), { name: 'mercure-subscribe-only', configureServer(server) { server.middlewares.use((req, res, next) => { if (req.url?.split('?')[0] === '/.well-known/mercure' && req.method !== 'GET') { res.statusCode=405; res.end('Subscriptions only'); return; } next(); }); } }], server: { port: 5173, strictPort: true, allowedHosts: ['frontend'], proxy: { '/api': 'http://backend:8000', '/.well-known/mercure': { target: 'http://mercure:80', timeout: 0, proxyTimeout: 0 } } } });
