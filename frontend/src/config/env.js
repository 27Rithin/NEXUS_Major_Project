// API_URL resolution priority:
// 1. VITE_API_URL env var (set by Render or .env.local) — used as-is if it's a full URL.
// 2. If VITE_API_URL is a bare hostname (from Render's fromService.property:host), wrap it.
// 3. Fall back to localhost for local development.

const defaultApiUrl = 'http://localhost:8000/api';

let rawUrl = import.meta.env.VITE_API_URL || '';

let baseApiUrl;

if (!rawUrl) {
    // No env var — use local dev default
    baseApiUrl = defaultApiUrl;
} else if (rawUrl.startsWith('http://') || rawUrl.startsWith('https://')) {
    // Already a full URL — use it directly, just ensure /api suffix
    // Ensure baseApiUrl ends clean without a trailing slash first
    baseApiUrl = rawUrl.replace(/\/+$/, '');

    // If it's already a full URL (http or https), use it then append /api/ if missing
    if (baseApiUrl.startsWith('http://') || baseApiUrl.startsWith('https://')) {
        if (!baseApiUrl.endsWith('/api')) {
            baseApiUrl = `${baseApiUrl}/api/`;
        } else {
            baseApiUrl = `${baseApiUrl}/`;
        }
    } else {
        // Bare hostname logic
        if (!baseApiUrl.includes('.')) {
            baseApiUrl = `${baseApiUrl}.onrender.com`;
        }
        baseApiUrl = `https://${baseApiUrl}/api/`;
    }
}

// Automatically construct WebSocket URL from API URL
let baseWsUrl = import.meta.env.VITE_WS_URL || '';
if (!baseWsUrl) {
    // Derive WS URL from HTTP API URL: replace http(s) with ws(s), strip /api, add /ws
    baseWsUrl = baseApiUrl
        .replace(/^https/, 'wss')
        .replace(/^http/, 'ws')
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
