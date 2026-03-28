import React, { useState, useContext } from 'react';
import { Link } from 'react-router-dom';
import { AuthContext } from '../contexts/AuthContextValue';
import { useToast } from '../components/useToast';
import { User, Mail, Building, Lock, Phone, AlertCircle, HeartPulse } from 'lucide-react';

import { Button } from '../components/ui/Button';
import { FormInput } from '../components/ui/FormInput';
import { PageTransition } from '../components/ui/PageTransition';
import { AuthLayout } from '../components/ui/AuthLayout';

const Register = () => {
    const [formData, setFormData] = useState({
        name: '',
        organization: '',
        email: '',
        password: '',
        role: 'Responder',
        phone: '',
        emergencyContact: '',
        medicalConditions: ''
    });
    const [isLoading, setIsLoading] = useState(false);

    const { register } = useContext(AuthContext);
    const { addToast } = useToast();

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const isFormValid = formData.name && formData.organization && formData.email && formData.password;

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!isFormValid) {
            addToast("Please fill in all required fields", "info");
            return;
        }

        setIsLoading(true);

        try {
            const result = await register(formData);
            if (!result?.success) {
                addToast(result?.error || "Registration failed", "error");
            } else {
                addToast("Registration successful! Proceeding to dashboard...", "success");
            }
        } catch (error) {
            addToast(error?.message || "An unexpected error occurred during registration", "error");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <PageTransition>
            <AuthLayout
                title="Create Account"
                subtitle="Request clearance to access NEXUS tools."
            >
                <form className="space-y-4" onSubmit={handleSubmit} noValidate>
                    <FormInput
                        id="name"
                        label="Full Name"
                        type="text"
                        icon={User}
                        value={formData.name}
                        onChange={handleChange}
                        placeholder="John Doe"
                        required
                    />

                    <FormInput
                        id="organization"
                        label="Organization"
                        type="text"
                        icon={Building}
                        value={formData.organization}
                        onChange={handleChange}
                        placeholder="National Coast Guard"
                        required
                    />

                    <FormInput
                        id="email"
                        label="Email Address"
                        type="email"
                        icon={Mail}
                        value={formData.email}
                        onChange={handleChange}
                        placeholder="john@example.com"
                        required
                    />

                    {/* Optional Preparedness Fields */}
                    <div className="pt-2 border-t border-slate-800">
                        <p className="text-xs text-slate-400 mb-4 uppercase tracking-wider font-semibold">Optional Preparedness Data</p>

                        <div className="space-y-4">
                            <FormInput
                                id="phone"
                                label="Phone Number"
                                type="tel"
                                icon={Phone}
                                value={formData.phone}
                                onChange={handleChange}
                                placeholder="+1 555-0198"
                            />

                            <FormInput
                                id="emergencyContact"
                                label="Emergency Contact (Name & Phone)"
                                type="text"
                                icon={AlertCircle}
                                value={formData.emergencyContact}
                                onChange={handleChange}
                                placeholder="Jane Doe - +1 555-0199"
                            />

                            <FormInput
                                id="medicalConditions"
                                label="Critical Medical Conditions"
                                type="text"
                                icon={HeartPulse}
                                value={formData.medicalConditions}
                                onChange={handleChange}
                                placeholder="e.g. Asthma, Penicillin Allergy (Leave blank if none)"
                            />
                        </div>
                    </div>

                    <FormInput
                        id="password"
                        label="Password"
                        type="password"
                        icon={Lock}
                        value={formData.password}
                        onChange={handleChange}
                        placeholder="••••••••"
                        required
                    />

                    <div className="space-y-1">
                        <label htmlFor="role" className="block text-sm font-medium text-slate-300">
                            Requested Role
                        </label>
                        <div className="relative">
                            <select
                                id="role"
                                name="role"
                                value={formData.role}
                                onChange={handleChange}
                                className="block w-full pl-3 pr-10 py-2.5 border border-slate-700/50 rounded-xl bg-slate-900/50 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-300 sm:text-sm shadow-inner appearance-none cursor-pointer"
                                aria-label="Requested Role"
                            >
                                <option value="Responder">Field Responder</option>
                                <option value="Viewer">Operations Viewer</option>
                                <option value="Admin">System Administrator</option>
                            </select>
                            <div className="absolute inset-y-0 right-0 flex items-center px-4 pointer-events-none">
                                <svg className="h-4 w-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                                </svg>
                            </div>
                        </div>
                    </div>

                    <div className="pt-4">
                        <Button type="submit" isLoading={isLoading} disabled={!isFormValid}>
                            Request Clearance
                        </Button>
                    </div>

                    <div className="text-center pt-2">
                        <span className="text-sm text-slate-400">
                            Already have an account?{' '}
                            <Link
                                to="/login"
                                className="text-indigo-400 font-medium hover:text-indigo-300 hover:underline transition-all duration-200"
                            >
                                Sign in here
                            </Link>
                        </span>
                    </div>
                </form>
            </AuthLayout>
        </PageTransition>
    );
};

export default Register;
