import React, { useState, useContext } from 'react';
import { Link } from 'react-router-dom';
import { AuthContext } from '../contexts/AuthContextValue';
import { useToast } from '../components/useToast';
import { Mail, Lock } from 'lucide-react';

import { Button } from '../components/ui/Button';
import { FormInput } from '../components/ui/FormInput';
import { PageTransition } from '../components/ui/PageTransition';
import { AuthLayout } from '../components/ui/AuthLayout';
import { config } from '../config/env';

const Login = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isBackendOff, setIsBackendOff] = React.useState(false);

    const { login } = useContext(AuthContext);
    const { addToast } = useToast();

    React.useEffect(() => {
        const check = async () => {
            try {
                const res = await fetch(`${config.serverOrigin}/`);
                setIsBackendOff(!res.ok);
            } catch {
                setIsBackendOff(true);
            }
        };
        check();
        const interval = setInterval(check, 5000);
        return () => clearInterval(interval);
    }, []);

    const isFormValid = email && password && !isBackendOff;

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!isFormValid) {
            addToast("Please fill in all required fields", "info");
            return;
        }

        setIsLoading(true);

        const result = await login(email, password);
        if (!result.success) {
            addToast(result.error || "Invalid credentials", "error");
        }
        setIsLoading(false);
    };

    return (
        <PageTransition>
            <AuthLayout
                title="Sign In"
                subtitle="Authenticate to access your operational dashboard."
            >
                {isBackendOff && (
                    <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-center animate-pulse">
                        <p className="text-red-400 text-xs font-bold uppercase tracking-widest flex items-center justify-center gap-2">
                            <span className="w-2 h-2 bg-red-500 rounded-full"></span>
                            CRITICAL: Backend API Offline
                        </p>
                        <p className="text-slate-400 text-[10px] mt-1">Please run start.bat to initiate services.</p>
                    </div>
                )}
                <form className="space-y-5" onSubmit={handleSubmit} noValidate>
                    <FormInput
                        id="email"
                        label="Email Address"
                        type="email"
                        icon={Mail}
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="john@example.com"
                        required
                    />

                    <FormInput
                        id="password"
                        label="Password"
                        type="password"
                        icon={Lock}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••"
                        required
                    />

                    <div className="pt-3">
                        <Button type="submit" isLoading={isLoading} disabled={!isFormValid}>
                            Initiate Secure Session
                        </Button>
                    </div>

                    <div className="text-center pt-4">
                        <span className="text-sm text-slate-400">
                            Authorized personnel only.{' '}
                            <Link
                                to="/register"
                                className="text-indigo-400 font-medium hover:text-indigo-300 hover:underline transition-all duration-200"
                            >
                                Request access here
                            </Link>
                        </span>
                    </div>
                </form>
            </AuthLayout>
        </PageTransition>
    );
};

export default Login;
