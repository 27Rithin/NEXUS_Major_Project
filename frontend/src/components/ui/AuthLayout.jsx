import React from 'react';
import { motion } from 'framer-motion';
import { Activity, ShieldCheck, MapPin, Hexagon } from 'lucide-react';

export const AuthLayout = ({ children, title, subtitle }) => {
    const MotionDiv = motion.div;
    return (
        <div className="min-h-screen relative flex items-center justify-center overflow-hidden bg-slate-950 font-sans">
            {/* Animated Background Blobs */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <MotionDiv
                    animate={{
                        scale: [1, 1.2, 1],
                        opacity: [0.15, 0.3, 0.15],
                        x: [0, 50, 0],
                        y: [0, -50, 0]
                    }}
                    transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
                    className="absolute -top-[10%] -left-[10%] w-[500px] h-[500px] bg-indigo-600/40 rounded-full blur-[100px] mix-blend-screen"
                />
                <MotionDiv
                    animate={{
                        scale: [1, 1.3, 1],
                        opacity: [0.1, 0.25, 0.1],
                        x: [0, -40, 0],
                        y: [0, 60, 0]
                    }}
                    transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
                    className="absolute top-[20%] -right-[10%] w-[600px] h-[600px] bg-violet-600/30 rounded-full blur-[120px] mix-blend-screen"
                />
                <MotionDiv
                    animate={{
                        scale: [1, 1.1, 1],
                        opacity: [0.15, 0.3, 0.15],
                        x: [0, 30, 0],
                        y: [0, 30, 0]
                    }}
                    transition={{ duration: 18, repeat: Infinity, ease: "linear" }}
                    className="absolute -bottom-[20%] left-[20%] w-[700px] h-[700px] bg-cyan-600/20 rounded-full blur-[150px] mix-blend-screen"
                />
            </div>

            <div className="container mx-auto px-4 py-8 relative z-10 w-full max-w-6xl flex items-center justify-center min-h-screen">
                <div className="w-full grid lg:grid-cols-2 gap-0 items-stretch rounded-3xl bg-slate-900/40 backdrop-blur-xl border border-white/10 shadow-2xl overflow-hidden min-h-[600px] relative">

                    {/* Inner glowing core behind everything in the card */}
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full bg-indigo-500/5 blur-[80px] pointer-events-none" />

                    {/* Left: Hero Section */}
                    <MotionDiv
                        initial={{ opacity: 0, x: -30 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.6, ease: "easeOut" }}
                        className="p-8 lg:p-14 flex flex-col justify-center bg-gradient-to-br from-indigo-950/80 via-slate-900/80 to-slate-900/80 border-b lg:border-b-0 lg:border-r border-white/5 relative overflow-hidden"
                    >
                        {/* Decorative hex icon */}
                        <div className="absolute -top-10 -left-10 text-indigo-500/10 rotate-12 pointer-events-none">
                            <Hexagon size={250} strokeWidth={1} />
                        </div>

                        <div className="relative z-10">
                            <h1 className="text-4xl lg:text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-indigo-400 to-violet-400 mb-6 drop-shadow-sm tracking-tight leading-tight">
                                NEXUS Edge Control
                            </h1>
                            <p className="text-slate-300 text-lg leading-relaxed mb-10 max-w-md font-medium">
                                Next-generation multi-modal disaster response and real-time operational telemetry platform.
                            </p>

                            <div className="space-y-6">
                                <MotionDiv whileHover={{ x: 5 }} className="flex items-start gap-4 p-3 -ml-3 rounded-xl hover:bg-white/5 transition-colors duration-300">
                                    <div className="p-2.5 bg-cyan-500/10 rounded-xl text-cyan-400 border border-cyan-500/20 shadow-[0_0_15px_rgba(34,211,238,0.15)] flex-shrink-0">
                                        <Activity size={22} />
                                    </div>
                                    <div>
                                        <h3 className="text-white font-semibold flex items-center gap-2">
                                            Real-time Monitoring
                                        </h3>
                                        <p className="text-sm text-slate-400 mt-1 leading-relaxed">Live ingest of social signals and environmental data streams.</p>
                                    </div>
                                </MotionDiv>

                                <MotionDiv whileHover={{ x: 5 }} className="flex items-start gap-4 p-3 -ml-3 rounded-xl hover:bg-white/5 transition-colors duration-300">
                                    <div className="p-2.5 bg-violet-500/10 rounded-xl text-violet-400 border border-violet-500/20 shadow-[0_0_15px_rgba(139,92,246,0.15)] flex-shrink-0">
                                        <ShieldCheck size={22} />
                                    </div>
                                    <div>
                                        <h3 className="text-white font-semibold">AI Detection Engine</h3>
                                        <p className="text-sm text-slate-400 mt-1 leading-relaxed">Cross-modal reasoning across YOLOv5 vision and NLP agents.</p>
                                    </div>
                                </MotionDiv>

                                <MotionDiv whileHover={{ x: 5 }} className="flex items-start gap-4 p-3 -ml-3 rounded-xl hover:bg-white/5 transition-colors duration-300">
                                    <div className="p-2.5 bg-indigo-500/10 rounded-xl text-indigo-400 border border-indigo-500/20 shadow-[0_0_15px_rgba(99,102,241,0.15)] flex-shrink-0">
                                        <MapPin size={22} />
                                    </div>
                                    <div>
                                        <h3 className="text-white font-semibold">Geo-Spatial Routing</h3>
                                        <p className="text-sm text-slate-400 mt-1 leading-relaxed">A* optimized operational dispatch avoiding hazardous zones.</p>
                                    </div>
                                </MotionDiv>
                            </div>
                        </div>
                    </MotionDiv>

                    {/* Right: Auth Form */}
                    <div className="p-8 lg:p-14 flex justify-center items-center relative bg-slate-900/30">
                        {/* Subtle form glow */}
                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-3/4 h-3/4 bg-violet-500/5 blur-[80px] rounded-full pointer-events-none" />

                        <MotionDiv
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.5, delay: 0.2, ease: "easeOut" }}
                            className="w-full max-w-sm relative z-10"
                        >
                            <div className="mb-8">
                                <h2 className="text-3xl font-bold text-white tracking-tight">{title}</h2>
                                <p className="text-slate-400 text-sm mt-2">{subtitle}</p>
                            </div>

                            {children}
                        </MotionDiv>
                    </div>

                </div>
            </div>
        </div>
    );
};
