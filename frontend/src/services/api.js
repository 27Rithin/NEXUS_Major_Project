import axios from 'axios';
import { config } from '../config/env';

const api = axios.create({
    baseURL: config.API_URL,
    timeout: 65000, 
    headers: {
        'Content-Type': 'application/json'
    }
});

api.interceptors.request.use((reqConfig) => {
    const token = localStorage.getItem('nexus_token');
    if (token) {
        reqConfig.headers.Authorization = `Bearer ${token}`;
    }
    return reqConfig;
}, (error) => Promise.reject(error));

// Add a response interceptor to handle session expiry (401)
api.interceptors.response.use(
    (response) => response,
    (error) => {
        const isLoginRequest = error.config?.url?.includes('auth/login');
        const isCitizenPage = window.location.pathname.includes('/citizen');
        
        if (error.response && error.response.status === 401 && !isLoginRequest && !isCitizenPage) {
            console.warn("Session expired or invalid. Redirecting to login...");
            localStorage.removeItem('nexus_token');
            localStorage.removeItem('nexus_user');
            // Use a small delay to avoid mid-render redirects
            setTimeout(() => { window.location.href = '/login'; }, 100);
        }
        return Promise.reject(error);
    }
);

// Helper to format errors
const formatError = (error, defaultMessage) => {
    if (error.response && error.response.data && error.response.data.detail) {
        return new Error(error.response.data.detail);
    }
    return new Error(defaultMessage || "An unexpected error occurred");
};

export const EventService = {
    getEvents: async () => {
        try {
            const response = await api.get('events/');
            return response.data;
        } catch (error) {
            throw formatError(error, "Failed to fetch active events");
        }
    },

    getRoute: async (eventId) => {
        try {
            const response = await api.get(`events/${eventId}/route`);
            return response.data;
        } catch (error) {
            throw formatError(error, "Failed to fetch event route");
        }
    },

    triggerCrossModal: async (eventId) => {
        try {
            const response = await api.post(`events/${eventId}/cross-modal-trigger`);
            return response.data;
        } catch (error) {
            throw formatError(error, "Failed to trigger cross-modal engine");
        }
    },

    dispatchUnit: async (eventId, unitType, notes = "", overrideLat = null, overrideLng = null) => {
        try {
            const payload = {
                unit_type: unitType,
                notes: notes
            };
            if (overrideLat !== null && overrideLng !== null) {
                payload.override_lat = parseFloat(overrideLat);
                payload.override_lng = parseFloat(overrideLng);
            }
            const response = await api.post(`events/${eventId}/dispatch`, payload);
            return response.data;
        } catch (error) {
            throw formatError(error, "Failed to deploy unit");
        }
    },

    suggestDispatch: async (eventId, unitType, destLat, destLng) => {
        try {
            const payload = {
                unit_type: unitType,
                dest_lat: parseFloat(destLat),
                dest_lng: parseFloat(destLng)
            };
            const response = await api.post(`events/${eventId}/suggest-dispatch`, payload);
            return response.data;
        } catch (error) {
            throw formatError(error, "Failed to suggest dispatch route");
        }
    }
};

export const AgentService = {
    simulateSocialPost: async () => {
        try {
            const response = await api.post('agents/social/simulate');
            return response.data;
        } catch (error) {
            throw formatError(error, "Failed to simulate social media feed");
        }
    },

    analyzeVision: async (eventId, imageUrl) => {
        try {
            const response = await api.post(`agents/vision/analyze/${eventId}`, null, {
                params: { image_url: imageUrl }
            });
            return response.data;
        } catch (error) {
            throw formatError(error, "Failed to analyze vision data");
        }
    }
};

export default api;
