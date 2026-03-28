import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertCircle, CheckCircle, Info, X, AlertTriangle } from 'lucide-react';
import { ToastContext } from './ToastContext';

const MotionDiv = motion.div;

export function ToastProvider({ children }) {
    const [toasts, setToasts] = useState([]);

    const removeToast = useCallback((id) => {
        setToasts((prev) => prev.filter((toast) => toast.id !== id));
    }, []);

    const addToast = useCallback((message, type = 'error', duration = 5000) => {
        const id = Date.now().toString();
        setToasts((prev) => [...prev, { id, message, type }]);

        if (duration > 0) {
            setTimeout(() => {
                removeToast(id);
            }, duration);
        }
    }, [removeToast]);

    return (
        <ToastContext.Provider value={{ addToast, removeToast }}>
            {children}
            <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
                <AnimatePresence>
                    {toasts.map((toast) => (
                        <Toast key={toast.id} toast={toast} onRemove={() => removeToast(toast.id)} />
                    ))}
                </AnimatePresence>
            </div>
        </ToastContext.Provider>
    );
}

// Internal Toast Component
const Toast = ({ toast, onRemove }) => {
    const icons = {
        error: <AlertCircle size={20} className="text-red-400" />,
        success: <CheckCircle size={20} className="text-green-400" />,
        warning: <AlertTriangle size={20} className="text-amber-400" />,
        info: <Info size={20} className="text-cyan-400" />
    };

    const borders = {
        error: "border-red-500/50 bg-red-950/80",
        success: "border-green-500/50 bg-green-950/80",
        warning: "border-amber-500/50 bg-amber-950/80",
        info: "border-cyan-500/50 bg-cyan-950/80"
    };

    return (
        <MotionDiv
            initial={{ opacity: 0, y: 50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
            className={`flex items-center gap-3 p-4 rounded-lg border shadow-xl backdrop-blur-md min-w-[300px] max-w-sm ${borders[toast.type]}`}
        >
            {icons[toast.type]}
            <p className="text-slate-200 text-sm flex-1 font-medium">{toast.message}</p>
            <button
                onClick={onRemove}
                className="text-slate-400 hover:text-white transition-colors"
            >
                <X size={16} />
            </button>
        </MotionDiv>
    );
};
