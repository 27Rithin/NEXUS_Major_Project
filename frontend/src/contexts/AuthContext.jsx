import api from '../services/api';
import { useNavigate } from 'react-router-dom';
import React, { useState, useEffect } from 'react';
import { AuthContext } from './AuthContextValue';

/**
 * Decodes a JWT token payload and checks if it has expired.
 * This runs entirely on the client — no network call required.
 * Returns true if the token is missing, malformed, or past its exp time.
 */
const isTokenExpired = (token) => {
    if (!token) return true;
    try {
        // JWT structure: header.payload.signature (all base64url encoded)
        const payloadBase64 = token.split('.')[1];
        if (!payloadBase64) return true;
        const payload = JSON.parse(atob(payloadBase64.replace(/-/g, '+').replace(/_/g, '/')));
        if (!payload.exp) return true;
        // exp is in seconds, Date.now() is in milliseconds
        return payload.exp * 1000 < Date.now();
    } catch {
        return true; // malformed token → treat as expired
    }
};

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();

    useEffect(() => {
        const token = localStorage.getItem('nexus_token');

        if (!token || isTokenExpired(token)) {
            // Token is missing or provably expired — clear it instantly.
            // No network call needed. PrivateRoute will handle the redirect.
            if (token) {
                localStorage.removeItem('nexus_token');
                console.info('[NEXUS] Stale token cleared on startup.');
            }
            setLoading(false);
            return;
        }

        // Token exists and hasn't expired yet — verify with backend.
        fetchCurrentUser();
    }, []);

    const fetchCurrentUser = async () => {
        try {
            const response = await api.get('/auth/me');
            setUser(response.data);
        } catch (err) {
            // Backend rejected the token (revoked, server restarted, etc.)
            // Clear silently — do NOT call logout() which triggers navigate().
            console.warn('[NEXUS] Token rejected by server. Clearing session.', err);
            localStorage.removeItem('nexus_token');
            setUser(null);
        } finally {
            setLoading(false);
        }
    };

    const login = async (email, password) => {
        try {
            const formData = new URLSearchParams();
            formData.append('username', email);
            formData.append('password', password);

            const response = await api.post('/auth/login', formData, {
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
            });

            const { access_token, user: userData } = response.data;
            localStorage.setItem('nexus_token', access_token);

            setUser(userData);
            navigate('/dashboard');
            return { success: true };
        } catch (error) {
            let errorMsg = 'Login failed. Please check your credentials.';
            
            if (!error.response) {
                // Network error (backend is down)
                errorMsg = 'CRITICAL: Backend API is offline. Please start the server.';
            } else if (error.response.status === 401) {
                errorMsg = 'Invalid email or password.';
            } else if (error.response.data?.detail) {
                errorMsg = error.response.data.detail;
            }

            return { success: false, error: errorMsg };
        }
    };

    const register = async (userData) => {
        try {
            await api.post('/auth/register', userData);
            return await login(userData.email, userData.password);
        } catch (error) {
            return {
                success: false,
                error: error.response?.data?.detail || 'Registration failed.'
            };
        }
    };

    const logout = () => {
        localStorage.removeItem('nexus_token');
        setUser(null);
        navigate('/login');
    };

    return (
        <AuthContext.Provider value={{ user, loading, login, register, logout }}>
            {children}
        </AuthContext.Provider>
    );
};
