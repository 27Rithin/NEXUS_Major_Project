import React from 'react';
import { motion } from 'framer-motion';
import { Loader2 } from 'lucide-react';

export const Button = ({ children, isLoading, disabled, className = '', ...props }) => {
    const MotionButton = motion.button;
    return (
        <MotionButton
            whileHover={!isLoading && !disabled ? { scale: 1.02, translateY: -1 } : {}}
            whileTap={!isLoading && !disabled ? { scale: 0.98 } : {}}
            disabled={isLoading || disabled}
            className={`w-full flex justify-center py-3 px-4 rounded-xl shadow-lg border text-sm font-semibold transition-all duration-300 ${!disabled
                    ? 'bg-indigo-600 hover:bg-indigo-500 text-white border-indigo-500/50 shadow-indigo-500/25 cursor-pointer'
                    : 'bg-slate-700 text-slate-400 border-slate-600 cursor-not-allowed opacity-70'
                } ${className}`}
            {...props}
        >
            {isLoading ? (
                <span className="flex items-center gap-2">
                    <Loader2 className="animate-spin" size={18} />
                    Processing...
                </span>
            ) : (
                children
            )}
        </MotionButton>
    );
};
