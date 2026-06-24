// server.js - Lightweight local HTTP server for Cambus Connect
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 3000;

const MIME_TYPES = {
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'application/javascript',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
    '.txt': 'text/plain'
};

const server = http.createServer((req, res) => {
    console.log(`[Request] ${req.method} ${req.url}`);
    
    // Parse URL and strip query strings or hash parameters
    const parsedUrl = new URL(req.url, `http://localhost:${PORT}`);
    let safePath = path.normalize(parsedUrl.pathname);
    
    // Avoid directory traversal attacks
    if (safePath.startsWith('..') || safePath.includes('..')) {
        res.statusCode = 403;
        res.end('Access Denied');
        return;
    }
    
    // Serve index.html if pointing to directory
    if (safePath === '/' || safePath === '\\') {
        safePath = '/index.html';
    }
    
    const filePath = path.join(__dirname, safePath);
    
    fs.stat(filePath, (err, stats) => {
        if (err || !stats.isFile()) {
            res.statusCode = 404;
            res.setHeader('Content-Type', 'text/html');
            res.end(`<h1>404 Not Found</h1><p>The file ${safePath} could not be found on this server.</p>`);
            return;
        }
        
        const ext = path.extname(filePath).toLowerCase();
        const contentType = MIME_TYPES[ext] || 'application/octet-stream';
        
        res.setHeader('Content-Type', contentType);
        res.statusCode = 200;
        
        const stream = fs.createReadStream(filePath);
        stream.pipe(res);
    });
});

server.listen(PORT, () => {
    console.log('\n================================================================');
    console.log(`🚀 CAMBUS CONNECT LOCAL WEB SERVER IS UP AND RUNNING!`);
    console.log(`📡 Access the application at: http://localhost:${PORT}`);
    console.log('================================================================\n');
    console.log(`To access the Admin Portal directly:`);
    console.log(`👉 http://localhost:${PORT}/portals/admin/admin-login.html\n`);
    console.log(`To access the Route Optimizer Console directly:`);
    console.log(`👉 http://localhost:${PORT}/portals/admin/route-optimizer/optimizer.html\n`);
    console.log('Press Ctrl+C to stop the server.\n');
});

