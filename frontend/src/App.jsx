import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import { AuthProvider } from './contexts/AuthContext';
import { AuthContext } from './contexts/AuthContextValue';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import CitizenApp from './pages/CitizenApp';
import React from 'react';
import { ToastProvider } from './components/ToastProvider';
const PrivateRoute = ({ children }) => {
    const { user, loading } = React.useContext(AuthContext);

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-900 flex items-center justify-center">
                <div className="text-cyan-400 text-xl font-mono animate-pulse">Initializing NEXUS Secure Connection...</div>
            </div>
        );
    }

    return user ? children : <Navigate to="/login" />;
};



const AnimatedRoutes = () => {
    const location = useLocation();

    return (
        <AnimatePresence>
            <Routes location={location} key={location.pathname}>
                <Route path="/login" element={<Login />} />
                <Route path="/register" element={<Register />} />
                <Route path="/citizen" element={<CitizenApp />} />
                <Route
                    path="/dashboard"
                    element={
                        <PrivateRoute>
                            <Dashboard />
                        </PrivateRoute>
                    }
                />
                <Route path="/" element={<Navigate to="/citizen" replace />} />
            </Routes>
        </AnimatePresence>
    );
};

function App() {
    return (
        <Router>
            <AuthProvider>
                <ToastProvider>
                    <AnimatedRoutes />
                </ToastProvider>
            </AuthProvider>
        </Router>
    );
}

export default App;
