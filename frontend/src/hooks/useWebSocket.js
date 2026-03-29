import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * Robust WebSocket hook for NEXUS Mission Control.
 * Implements heartbeats, exponential backoff, and state synchronization.
 */
export const useWebSocket = (url, onMessage) => {
    const [status, setStatus] = useState('connecting'); // 'connecting', 'connected', 'disconnected', 'reconnecting'
    const ws = useRef(null);
    const reconnectAttempts = useRef(0);
    const maxReconnectDelay = 30000;
    const heartbeatInterval = useRef(null);

    const connect = useCallback(() => {
        if (!url) return;
        
        console.log(`[NEXUS-WS] Connecting to Mission Control: ${url}`);
        const socket = new WebSocket(url);
        ws.current = socket;

        socket.onopen = () => {
            console.log('[NEXUS-WS] Operational: Connected.');
            setStatus('connected');
            reconnectAttempts.current = 0;
            
            // Start Hearbeat (PING every 25s to keep proxy connections alive)
            heartbeatInterval.current = setInterval(() => {
                if (socket.readyState === WebSocket.OPEN) {
                    socket.send(JSON.stringify({ type: 'ping', timestamp: Date.now() }));
                }
            }, 25000);
        };

        socket.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                if (data.type === 'pong') {
                    console.log(`[NEXUS-WS] Heartbeat OK: Server Pong received.`);
                    return;
                }
                if (onMessage) onMessage(data);
            } catch (err) {
                console.error('[NEXUS-WS] Payload Error:', err);
            }
        };

        socket.onclose = (event) => {
            clearInterval(heartbeatInterval.current);
            if (!event.wasClean) {
                const delay = Math.min(1000 * Math.pow(2, reconnectAttempts.current), maxReconnectDelay);
                console.warn(`[NEXUS-WS] Disconnected. Reconnecting in ${delay}ms...`);
                setStatus('reconnecting');
                reconnectAttempts.current += 1;
                setTimeout(connect, delay);
            } else {
                setStatus('disconnected');
            }
        };

        socket.onerror = (err) => {
            console.error('[NEXUS-WS] Terminal Error:', err);
            socket.close(); // Trigger onclose for retry
        };
    }, [url, onMessage]);

    useEffect(() => {
        connect();
        return () => {
            if (ws.current) {
                ws.current.close(1000, 'Cleanup on Unmount');
            }
            clearInterval(heartbeatInterval.current);
        };
    }, [connect]);

    return { status, ws: ws.current };
};
