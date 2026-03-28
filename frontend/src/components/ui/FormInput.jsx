import React, { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';

export const FormInput = ({ id, label, type = 'text', icon: Icon, value, onChange, placeholder, required, className = '', ...props }) => {
    const [showPassword, setShowPassword] = useState(false);
    const isPassword = type === 'password';
    const currentType = isPassword && showPassword ? 'text' : type;

    return (
        <div className={`space-y-1 ${className}`}>
            <label htmlFor={id} className="block text-sm font-medium text-slate-300">
                {label}
            </label>
            <div className="relative">
                {Icon && (
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                        <Icon size={18} aria-hidden="true" />
                    </div>
                )}
                <input
                    id={id}
                    name={id}
                    type={currentType}
                    required={required}
                    value={value}
                    onChange={onChange}
                    placeholder={placeholder}
                    className={`block w-full ${Icon ? 'pl-10' : 'pl-3'} ${isPassword ? 'pr-10' : 'pr-3'} py-2.5 border border-slate-700/50 rounded-xl bg-slate-900/50 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-300 sm:text-sm shadow-inner`}
                    aria-required={required}
                    {...props}
                />
                {isPassword && (
                    <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-indigo-400 transition-colors focus:outline-none"
                    >
                        {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                )}
            </div>
        </div>
    );
};
