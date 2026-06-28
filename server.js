// server.js - Lightweight local HTTP server for Cambus Connect
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 3000;
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const RATE_LIMIT_MAX_REQUESTS = 120;
const rateLimitBuckets = new Map();

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

function getClientKey(req) {
    const forwardedFor = req.headers['x-forwarded-for'];
    const ip = Array.isArray(forwardedFor)
        ? forwardedFor[0]
        : String(forwardedFor || req.headers['x-real-ip'] || req.socket?.remoteAddress || 'unknown')
            .split(',')[0]
            .trim();
    return `${ip}:${(req.headers.host || 'unknown').toLowerCase()}`;
}

function applyRateLimit(req, res) {
    const key = getClientKey(req);
    const now = Date.now();
    let bucket = rateLimitBuckets.get(key);

    if (!bucket || now >= bucket.resetAt) {
        bucket = { count: 0, resetAt: now + RATE_LIMIT_WINDOW_MS };
    }

    bucket.count += 1;
    rateLimitBuckets.set(key, bucket);

    res.setHeader('X-RateLimit-Limit', String(RATE_LIMIT_MAX_REQUESTS));
    res.setHeader('X-RateLimit-Remaining', String(Math.max(0, RATE_LIMIT_MAX_REQUESTS - bucket.count)));
    res.setHeader('X-RateLimit-Reset', String(Math.ceil(bucket.resetAt / 1000)));

    if (bucket.count > RATE_LIMIT_MAX_REQUESTS) {
        const retryAfter = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));
        res.statusCode = 429;
        res.setHeader('Retry-After', String(retryAfter));
        res.end('Too many requests. Please try again later.');
        return false;
    }

    return true;
}

const server = http.createServer((req, res) => {
    console.log(`[Request] ${req.method} ${req.url}`);

    if (!applyRateLimit(req, res)) {
        return;
    }
    
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
    
    const filePath = path.join(__dirname, 'client', safePath);
    
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
