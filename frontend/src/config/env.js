// API_URL is the FastAPI /api prefix root (e.g. http://localhost:8000/api).
// Use serverOrigin for routes on the app root (e.g. GET /).
const defaultApiUrl = 'http://localhost:8000/api';

// Handle dynamic Vite injection (e.g., from Render deploying the backend)
let baseApiUrl = import.meta.env.VITE_API_URL || defaultApiUrl;

// If Render passes just the 'host' (e.g., nexus-backend-xyz.onrender.com), make it a full URL
if (!baseApiUrl.startsWith('http://') && !baseApiUrl.startsWith('https://')) {
    baseApiUrl = `https://${baseApiUrl}`;
}

if (!baseApiUrl.endsWith('/api')) {
    baseApiUrl = `${baseApiUrl.replace(/\/$/, '')}/api`;
}

// Automatically construct WebSocket URL from API URL if not explicitly provided
let baseWsUrl = import.meta.env.VITE_WS_URL;
if (!baseWsUrl && baseApiUrl) {
    baseWsUrl = baseApiUrl.replace(/^http/, 'ws').replace(/\/api$/, '') + '/ws';
} else if (!baseWsUrl) {
    baseWsUrl = 'ws://localhost:8000/ws';
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
