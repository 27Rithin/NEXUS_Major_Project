// API_URL resolution priority:
// 1. VITE_API_URL env var (set by Render or .env.local) — used as-is if it's a full URL.
// 2. If VITE_API_URL is a bare hostname (from Render's fromService.property:host), wrap it.
// 3. Fall back to localhost for local development.

const defaultApiUrl = 'http://localhost:8000/api';

let rawUrl = import.meta.env.VITE_API_URL || '';

let baseApiUrl;

if (!rawUrl) {
    baseApiUrl = defaultApiUrl;
} else {
    // Standardize: Remove trailing slash first
    const cleanUrl = rawUrl.trim().replace(/\/+$/, '');
    
    if (cleanUrl.startsWith('http')) {
        // Full URL provided: ensure it ends in /api/
        if (cleanUrl.endsWith('/api')) {
            baseApiUrl = `${cleanUrl}/`;
        } else if (cleanUrl.includes('/api/')) {
            baseApiUrl = `${cleanUrl.split('/api/')[0]}/api/`;
        } else {
            baseApiUrl = `${cleanUrl}/api/`;
        }
    } else {
        // Bare hostname provided (Render internal or short name)
        const host = cleanUrl.includes('.') ? cleanUrl : `${cleanUrl}.onrender.com`;
        baseApiUrl = `https://${host}/api/`;
    }
}

// Automatically construct WebSocket URL from API URL
let baseWsUrl = import.meta.env.VITE_WS_URL || '';
if (!baseWsUrl) {
    // Derive WS URL from HTTP API URL: replace http(s) with ws(s), strip /api, add /ws
    baseWsUrl = baseApiUrl
        .replace(/^https/, 'wss')
        .replace(/^http/, 'ws')
        .replace(/\/api\/.*$/, '/ws')
        .replace(/\/api$/, '/ws');
}

export const config = {
    WS_URL: baseWsUrl,
    API_URL: baseApiUrl,
    get serverOrigin() {
        try {
            return new URL(this.API_URL).origin;
        } catch {
            return 'http://localhost:8000';
        }
    },
};
