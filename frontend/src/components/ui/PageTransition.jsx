import React from 'react';
import { motion } from 'framer-motion';

export const PageTransition = ({ children, className = '' }) => {
    const MotionDiv = motion.div;
    return (
        <MotionDiv
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
            className={className}
        >
            {children}
        </MotionDiv>
    );
};
