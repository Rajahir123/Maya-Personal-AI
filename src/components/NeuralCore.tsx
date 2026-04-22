import React, { useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';

interface NeuralCoreProps {
  status: 'disconnected' | 'connecting' | 'idle' | 'listening' | 'speaking';
  isPowerOn: boolean;
  onClick?: () => void;
}

export const NeuralCore: React.FC<NeuralCoreProps> = ({ status, isPowerOn, onClick }) => {
  const isActive = isPowerOn && status !== 'disconnected';

  // Generate some static "neural nodes"
  const nodes = useMemo(() => {
    return Array.from({ length: 12 }).map((_, i) => ({
      id: i,
      angle: (i * 360) / 12,
      delay: Math.random() * 2
    }));
  }, []);

  return (
    <div className="relative w-[320px] h-[320px] flex items-center justify-center pointer-events-none">
      {/* Background Ambience */}
      <motion.div
        animate={{
          scale: isActive ? [1, 1.1, 1] : 1,
          opacity: isActive ? [0.1, 0.2, 0.1] : 0.05
        }}
        transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
        className="absolute inset-0 bg-blue-500/20 rounded-full blur-[100px]"
      />

      {/* Interactive Trigger Zone */}
      <div 
        className="absolute inset-0 z-20 cursor-pointer pointer-events-auto rounded-full"
        onClick={onClick}
      />

      {/* SVG Container */}
      <svg viewBox="0 0 400 400" className="w-full h-full relative z-10 drop-shadow-[0_0_15px_rgba(59,130,246,0.3)]">
        {/* Outer Telemetry Ring */}
        <motion.circle
          cx="200"
          cy="200"
          r="180"
          fill="none"
          stroke="currentColor"
          strokeWidth="0.5"
          className="text-white/10"
          strokeDasharray="4 8"
          animate={{ rotate: 360 }}
          transition={{ duration: 60, repeat: Infinity, ease: "linear" }}
        />

        {/* Data Fragments */}
        <motion.g
          animate={{ rotate: -360 }}
          transition={{ duration: 40, repeat: Infinity, ease: "linear" }}
          style={{ originX: '200px', originY: '200px' }}
        >
          {Array.from({ length: 4 }).map((_, i) => (
            <text
              key={i}
              x={200 + 190 * Math.cos((i * 90 * Math.PI) / 180)}
              y={200 + 190 * Math.sin((i * 90 * Math.PI) / 180)}
              className="fill-white/20 font-mono text-[8px] uppercase tracking-widest"
              style={{ transform: `rotate(${i * 90}deg)`, transformOrigin: 'center' }}
            >
              NODE_SYNC_{i+1}
            </text>
          ))}
        </motion.g>

        {/* Rotating Geometric Rings */}
        {isActive && (
          <>
            <motion.circle
              cx="200"
              cy="200"
              r="140"
              fill="none"
              stroke="url(#blueGradient)"
              strokeWidth="1.5"
              strokeDasharray="20 180"
              strokeLinecap="round"
              animate={{ rotate: 360 }}
              transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
            />
            <motion.circle
              cx="200"
              cy="200"
              r="145"
              fill="none"
              stroke="url(#purpleGradient)"
              strokeWidth="0.5"
              strokeDasharray="10 40"
              animate={{ rotate: -360 }}
              transition={{ duration: 12, repeat: Infinity, ease: "linear" }}
            />
          </>
        )}

        {/* Neural Nodes & Filaments */}
        <AnimatePresence>
          {isActive && nodes.map((node) => (
            <motion.g
              key={node.id}
              initial={{ opacity: 0, scale: 0 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0 }}
              transition={{ delay: node.delay * 0.5 }}
            >
              <line
                x1="200"
                y1="200"
                x2={200 + 100 * Math.cos((node.angle * Math.PI) / 180)}
                y2={200 + 100 * Math.sin((node.angle * Math.PI) / 180)}
                stroke="white"
                strokeWidth="0.2"
                strokeOpacity="0.1"
              />
              <motion.circle
                cx={200 + 100 * Math.cos((node.angle * Math.PI) / 180)}
                cy={200 + 100 * Math.sin((node.angle * Math.PI) / 180)}
                r="1.5"
                className="fill-blue-400"
                animate={{
                  opacity: [0.2, 1, 0.2],
                  scale: [1, 1.5, 1]
                }}
                transition={{
                  duration: 2 + Math.random(),
                  repeat: Infinity,
                  delay: node.delay
                }}
              />
            </motion.g>
          ))}
        </AnimatePresence>

        {/* Central Core */}
        <defs>
          <radialGradient id="coreGradient" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#60a5fa" />
            <stop offset="40%" stopColor="#7c3aed" />
            <stop offset="100%" stopColor="#1e1b4b" />
          </radialGradient>
          <radialGradient id="coreGradientOuter" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.8" />
            <stop offset="100%" stopColor="#8b5cf6" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="glossGradient" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="white" stopOpacity="0.4" />
            <stop offset="100%" stopColor="white" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="blueGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#3b82f6" stopOpacity="0" />
            <stop offset="50%" stopColor="#3b82f6" stopOpacity="0.8" />
            <stop offset="100%" stopColor="#3b82f6" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="purpleGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#a855f7" stopOpacity="0" />
            <stop offset="50%" stopColor="#a855f7" stopOpacity="0.5" />
            <stop offset="100%" stopColor="#a855f7" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* The Core Orb - Multi Layer */}
        <motion.circle
          cx="200"
          cy="200"
          r={isActive ? 64 : 40}
          fill="url(#coreGradientOuter)"
          animate={isActive ? {
            r: status === 'speaking' ? [64, 75, 64] : status === 'listening' ? [64, 68, 64] : [64, 66, 64],
            opacity: [0.3, 0.6, 0.3],
            filter: 'blur(20px)'
          } : { r: 40, opacity: 0.1, filter: 'blur(30px)' }}
          transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
        />
        
        <motion.circle
          cx="200"
          cy="200"
          r={isActive ? 58 : 35}
          fill="url(#coreGradient)"
          animate={isActive ? {
            r: status === 'speaking' ? [58, 68, 58] : status === 'listening' ? [58, 62, 58] : [58, 60, 58],
            opacity: status === 'connecting' ? [0.6, 1, 0.6] : 1,
            filter: status === 'speaking' ? 'blur(10px)' : 'blur(4px)',
            strokeWidth: status === 'speaking' ? [1, 4, 1] : 0.5
          } : { r: 35, opacity: 0.3, filter: 'blur(10px)' }}
          transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
          stroke="rgba(255,255,255,0.1)"
        />

        {/* Scanning Beam */}
        {isActive && status === 'listening' && (
          <motion.rect
            x="0"
            y="200"
            width="400"
            height="1"
            fill="rgba(59,130,246,0.3)"
            animate={{ y: [160, 240, 160], opacity: [0, 1, 0] }}
            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
            filter="blur(2px)"
          />
        )}

        {/* Glossy Reflection Overlay */}
        <motion.circle
          cx="180"
          cy="180"
          r={isActive ? 30 : 20}
          fill="url(#glossGradient)"
          animate={isActive ? {
            opacity: [0.1, 0.3, 0.1],
            x: [0, 5, 0],
            y: [0, 5, 0]
          } : { opacity: 0 }}
          transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
        />

        {/* Pulse Waves when active */}
        <AnimatePresence>
          {status === 'speaking' && (
            [80, 100, 120].map((radius, i) => (
              <motion.circle
                key={i}
                cx="200"
                cy="200"
                r={radius}
                fill="none"
                stroke="#3b82f6"
                strokeWidth="0.5"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: [0, 0.3, 0], scale: [0.8, 1.2, 1.5] }}
                transition={{ duration: 2, repeat: Infinity, delay: i * 0.4 }}
              />
            ))
          )}
        </AnimatePresence>

        {/* Connection Arcs */}
        <AnimatePresence>
          {status === 'connecting' && (
            <motion.path
              d="M 120 200 A 80 80 0 0 1 280 200"
              fill="none"
              stroke="#3b82f6"
              strokeWidth="2"
              strokeDasharray="10 100"
              animate={{ strokeDashoffset: -200 }}
              transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
            />
          )}
        </AnimatePresence>
      </svg>

      {/* HUD Elements around the core */}
      <AnimatePresence>
        {isActive && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="absolute inset-0 overflow-hidden rounded-full border border-white/5"
          >
            {/* Spinning data ticks */}
            <div className="absolute inset-0 flex items-center justify-center">
              {Array.from({ length: 36 }).map((_, i) => (
                <div
                  key={i}
                  className="absolute w-px h-1 bg-white/20"
                  style={{
                    transform: `rotate(${i * 10}deg) translateY(-170px)`
                  }}
                />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
