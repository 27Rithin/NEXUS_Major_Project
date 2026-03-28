import {
    Droplets,
    Activity,
    Wind,
    Mountain,
    Flame,
    Building2,
    Factory,
    Car,
    AlertTriangle,
    ShieldAlert
} from 'lucide-react';

export const DisasterTypeConfig = {
    'SOS / Undefined': {
        color: '#EF4444', // Red-500
        icon: ShieldAlert,
        animationClass: 'animate-pulse-heavy',
        severityEffect: 'pulse'
    },
    'Flood': {
        color: '#3B82F6', // Blue-500
        icon: Droplets,
        animationClass: 'animate-ripple',
        severityEffect: 'wave'
    },
    'Earthquake': {
        color: '#8B5CF6', // Violet-500
        icon: Activity,
        animationClass: 'animate-shake',
        severityEffect: 'shake'
    },
    'Cyclone': {
        color: '#06B6D4', // Cyan-500
        icon: Wind,
        animationClass: 'animate-spin-slow',
        severityEffect: 'rotate'
    },
    'Hurricane': {
        color: '#06B6D4', // Cyan-500
        icon: Wind,
        animationClass: 'animate-spin-slow',
        severityEffect: 'rotate'
    },
    'Landslide': {
        color: '#D97706', // Amber-600
        icon: Mountain,
        animationClass: 'animate-rumble',
        severityEffect: 'rumble'
    },
    'Forest Fire': {
        color: '#EF4444', // Red-500
        icon: Flame,
        animationClass: 'animate-flicker',
        severityEffect: 'flicker'
    },
    'Urban Fire': {
        color: '#DC2626', // Red-600
        icon: Flame,
        animationClass: 'animate-flicker',
        severityEffect: 'flicker'
    },
    'Building Collapse': {
        color: '#64748B', // Slate-500
        icon: Building2,
        animationClass: 'animate-pulse-heavy',
        severityEffect: 'pulse'
    },
    'Industrial Accident': {
        color: '#EAB308', // Yellow-500
        icon: Factory,
        animationClass: 'animate-glow-alert',
        severityEffect: 'glow'
    },
    'Road Accident': {
        color: '#F97316', // Orange-500
        icon: Car,
        animationClass: 'animate-flash',
        severityEffect: 'flash'
    },
    'Transport Accident': {
        color: '#F97316', // Orange-500
        icon: Car,
        animationClass: 'animate-flash',
        severityEffect: 'flash'
    },
    'Default': {
        color: '#10B981', // Emerald-500
        icon: AlertTriangle,
        animationClass: 'animate-pulse',
        severityEffect: 'pulse'
    }
};

export const getDisasterConfig = (category) => {
    if (!category) return DisasterTypeConfig['Default'];
    
    // Attempt exact match first
    if (DisasterTypeConfig[category]) {
        return DisasterTypeConfig[category];
    }

    // Attempt partial string match (e.g., matching "Urban Fire Accidents" to "Urban Fire")
    const lowerCategory = String(category).toLowerCase();
    for (const [key, config] of Object.entries(DisasterTypeConfig)) {
        if (key !== 'Default' && lowerCategory.includes(key.toLowerCase())) {
            return config;
        }
    }

    return DisasterTypeConfig['Default'];
};
