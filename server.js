// server.js - Lightweight local HTTP server for Cambus Connect
const http = require('http');
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

const PORT = 3000;
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const RATE_LIMIT_MAX_REQUESTS = 120;
const rateLimitBuckets = new Map();

const MIME_TYPES = {
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'application/javascript',
    '.mjs': 'application/javascript',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.webp': 'image/webp',
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
    
    function serve404() {
        const notFoundPath = path.join(__dirname, '404.html');
        if (fs.existsSync(notFoundPath)) {
            res.statusCode = 404;
            res.setHeader('Content-Type', 'text/html');
            fs.createReadStream(notFoundPath).pipe(res);
        } else {
            res.statusCode = 404;
            res.setHeader('Content-Type', 'text/html');
            res.end(`<h1>404 Not Found</h1><p>The requested file could not be found on this server.</p>`);
        }
    }

    // Parse URL and strip query strings or hash parameters
    const parsedUrl = new URL(req.url, `http://localhost:${PORT}`);

    // API endpoint router
    if (parsedUrl.pathname.startsWith('/api/')) {
        const apiDir = path.resolve(__dirname, 'api');
        const rawApiName = parsedUrl.pathname.replace(/^\/api\//, '').replace(/\.js$/, '');
        const safeApiName = path.basename(rawApiName);
        const apiFilePath = path.join(apiDir, `${safeApiName}.js`);
        
        if (!apiFilePath.startsWith(apiDir) || !fs.existsSync(apiFilePath)) {
            res.statusCode = 404;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: `API route not found` }));
            return;
        }

        req.query = Object.fromEntries(parsedUrl.searchParams.entries());

        res.status = function(code) {
            this.statusCode = code;
            return this;
        };
        res.json = function(data) {
            this.setHeader('Content-Type', 'application/json');
            this.end(JSON.stringify(data));
            return this;
        };

        let bodyData = '';
        req.on('data', chunk => { bodyData += chunk; });
        req.on('end', async () => {
            if (bodyData) {
                try {
                    req.body = JSON.parse(bodyData);
                } catch (e) {
                    req.body = bodyData;
                }
            } else {
                req.body = {};
            }

            try {
                const fileUrl = pathToFileURL(apiFilePath).href;
                const mod = await import(fileUrl);
                const handler = mod.default || mod;
                if (typeof handler === 'function') {
                    await handler(req, res);
                } else {
                    res.status(500).json({ error: `Invalid handler exported in ${apiName}.js` });
                }
            } catch (apiError) {
                console.error(`[API Error] ${apiName}:`, apiError);
                if (!res.headersSent) {
                    res.status(500).json({ error: apiError.message });
                }
            }
        });
        return;
    }

    let safePath = path.normalize(parsedUrl.pathname);
    
    // Avoid directory traversal attacks
    if (safePath.startsWith('..') || safePath.includes('..')) {
        res.statusCode = 403;
        res.setHeader('Content-Type', 'text/plain');
        res.end('Access Denied');
        return;
    }
    
    // Block dotfiles (.env, .git, etc.) and sensitive project files
    const basename = path.basename(safePath).toLowerCase();
    const isDotFile = basename.startsWith('.') || safePath.includes('/.') || safePath.includes('\\.');
    const isSensitiveExt = /\.(env.*|bat|ps1|log|md|pptx|lock|rules)$/i.test(safePath);
    const SENSITIVE_FILES = [
        'package.json', 'package-lock.json', 'firebase.json', 
        'firestore.indexes.json', 'database.rules.json', 'tsconfig.json',
        'server.js', 'test-e2e.mjs', 'scratch.js'
    ];
    const isSensitiveFile = SENSITIVE_FILES.includes(basename);

    if (isDotFile || isSensitiveExt || isSensitiveFile) {
        res.statusCode = 403;
        res.setHeader('Content-Type', 'text/plain');
        res.end('Access Denied');
        return;
    }
    
    // Serve index.html if pointing to directory
    if (safePath === '/' || safePath === '\\') {
        safePath = '/index.html';
    }
    
    let filePath = path.join(__dirname, safePath);

    function serveFile(targetPath) {
        fs.stat(targetPath, (err, stats) => {
            if (err || !stats.isFile()) {
                serve404();
                return;
            }

            const ext = path.extname(targetPath).toLowerCase();
            const contentType = MIME_TYPES[ext] || 'application/octet-stream';

            res.setHeader('Content-Type', contentType);
            res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
            res.setHeader('Pragma', 'no-cache');
            res.setHeader('Expires', '0');
            res.statusCode = 200;

            const stream = fs.createReadStream(targetPath);
            stream.pipe(res);
        });
    }

    fs.stat(filePath, (err, stats) => {
        if (!err && stats.isDirectory()) {
            const dirIndex = path.join(filePath, 'index.html');
            const dirName = path.basename(filePath);
            const dirNamedHtml = path.join(filePath, `${dirName}.html`);

            if (fs.existsSync(dirIndex)) {
                serveFile(dirIndex);
            } else if (fs.existsSync(dirNamedHtml)) {
                serveFile(dirNamedHtml);
            } else {
                serve404();
            }
            return;
        }

        if (err && !path.extname(filePath)) {
            const withHtml = filePath + '.html';
            if (fs.existsSync(withHtml)) {
                serveFile(withHtml);
                return;
            }
        }

        serveFile(filePath);
    });
});

server.listen(PORT, () => {
    console.log('\n================================================================');
    console.log(`🚀 CAMBUS CONNECT LOCAL WEB SERVER IS UP AND RUNNING!`);
    console.log(`📡 Access the application at: http://localhost:${PORT}`);
    console.log('================================================================\n');
    console.log(`To access the Admin Portal directly:`);
    console.log(`👉 http://localhost:${PORT}/portals/admin/admin-login.html\n`);
    console.log('Press Ctrl+C to stop the server.\n');
});
