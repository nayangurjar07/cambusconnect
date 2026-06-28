# Cambus Connect - Secure Architecture & Project Folder Structure

This document outlines the recommended folder structure for **Cambus Connect** to protect sensitive data, prevent source code visibility in the browser (via DevTools/Inspect), and ensure secure multi-tenant routing.

---

## 📁 Recommended Project Folder Structure

To secure your codebase, you should separate client-side assets (which go through a build step) from server-side files (which execute securely on Node.js and are never exposed to the client browser).

```text
cambus-connect/
├── .git/
├── .gitignore                      # Crucial: Excludes node_modules, .env, and local sensitive configurations
├── .env.example                    # Template for environment variables (safe to commit to git)
├── .env                            # Sensitive environment credentials (ignored by git)
├── package.json                    # Project dependencies and build scripts
├── server.js                       # Secure Node.js backend server (handles APIs, serves public dist/)
│
├── client/                         # FRONTEND (Client-side source code)
│   ├── index.html                  # Main entry page
│   ├── vite.config.js              # Bundler config (disables source maps & minifies code)
│   ├── src/
│   │   ├── main.js                 # Frontend application entry point
│   │   ├── auth-guard.js           # Handles client authentication flow
│   │   ├── style.css               # Core styling and design tokens
│   │   ├── assets/                 # Shared images, icons, and fonts
│   │   ├── components/             # Reusable UI components
│   │   └── portals/                # Specific portal views and page logics
│   │       ├── student/            # Student portal pages and JS
│   │       ├── driver/             # Driver portal pages and JS
│   │       └── admin/              # Admin portal pages and JS
│   │
│   └── dist/                       # [GENERATED] Minified, bundled, and obfuscated production build
│                                   # (This is what server.js serves to the public browser!)
│
├── api/                            # BACKEND (Server-side API routes)
│   ├── db/                         # Database helpers & secure initialization (Firebase Admin SDK)
│   ├── controllers/                # Logic for handling backend endpoints
│   └── routes/                     # Secure backend route definitions (e.g., auth, tracking)
│
└── config/                         # CONFIGURATIONS
    ├── tenant-config.template.js   # Safe tenant structure template for developers
    └── tenant-config.js            # [IGNORED] Actual local tenant database configs & private API keys
```

---

## 🔒 1. How to Prevent Source Code Visibility in the Browser

When users right-click and select **Inspect -> Sources** in their browser, they can view plain JavaScript code if you serve raw source files. To completely prevent this:

### Step A: Use a Modern Bundler (e.g., Vite)
By bundling your client files using a tool like Vite or Webpack, the code is compiled, minified, and tree-shaken into a single compressed directory (`client/dist/`).

### Step B: Disable Source Maps
Source maps translate minified code back to your original readable files for debugging. **You must disable source maps in production.**

Create a `client/vite.config.js` file with the following configuration:

```javascript
import { defineConfig } from 'vite';

export default defineConfig({
  root: './client',
  build: {
    outDir: '../dist',
    sourcemap: false, // <-- CRITICAL: Disables source maps so DevTools cannot inspect original source code
    minify: 'terser', // <-- Uses Terser to aggressively compress and obfuscate variable names
    terserOptions: {
      compress: {
        drop_console: true, // Optional: Removes console.log statements in production
        drop_debugger: true
      },
      mangle: {
        toplevel: true // Obfuscates global variable and function names
      }
    }
  }
});
```

### Step C: Optional JavaScript Obfuscation
For maximum security, you can integrate `rollup-plugin-obfuscator` or `javascript-obfuscator` into your build pipeline. This transforms code into an unreadable state while preserving execution functionality.

---

## 🛡️ 2. Protecting Tenant configurations & API Keys

### Step A: Use `.gitignore`
We have successfully created a `.gitignore` at the root of the project to ensure that developers never accidentally commit sensitive keys to GitHub.

Files ignored include:
*   `tenant-config.js`
*   `firebase-config.js`
*   `.env`

### Step B: Move Database & Private Keys Server-Side
Instead of putting sensitive keys (like Firebase Database Write rules or private credentials) inside client-side JS:
1.  **Keep them on the backend**: Initialize Firebase in `server.js` or `api/db/` using environment variables.
2.  **Expose simple REST endpoints**: The frontend requests `/api/tenant/branding?domain=iist.cambusconnect.in`.
3.  The server checks `tenant-config.js` on the backend and returns **only** non-sensitive branding info (logo URL, colors, name) back to the client:
    ```json
    {
      "name": "Indore Institute of Science and Technology",
      "logoUrl": "https://example.com/logo.png",
      "colors": { "primary": "#003366" }
    }
    ```
4.  Private configuration and DB keys remain strictly in server memory, completely invisible to the browser.
