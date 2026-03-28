import React from 'react';
import { motion } from 'framer-motion';

export const Card = ({ children, className = '', glow = true }) => {
    const MotionDiv = motion.div;
    return (
        <div className="relative w-full max-w-[420px] mx-auto">
            {/* Subtle Background Glow */}
            {glow && (
                <div className="absolute -inset-1 bg-indigo-500 rounded-3xl blur-2xl opacity-20 pointer-events-none" />
            )}

            {/* Card Content with Entrance Animation */}
            <MotionDiv
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, ease: "easeOut" }}
                className={`relative bg-slate-800/40 backdrop-blur-xl py-8 px-6 shadow-2xl rounded-2xl border border-slate-700/50 transition-all duration-300 ${className}`}
            >
                {children}
            </MotionDiv>
        </div>
    );
};
