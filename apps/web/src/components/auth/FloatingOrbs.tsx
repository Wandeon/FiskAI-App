"use client"

import { motion } from "framer-motion"
import { useMemo } from "react"

export type AuthState =
  | "identify"
  | "authenticate"
  | "register"
  | "verify"
  | "reset"
  | "success"
  | "error"

interface FloatingOrbsProps {
  state: AuthState
  className?: string
}

// Color palettes for each state
const stateColors: Record<AuthState, string[]> = {
  identify: ["#0891b2", "#14b8a6", "#a855f7", "#06b6d4"],
  authenticate: ["#0891b2", "#3b82f6", "#0ea5e9", "#06b6d4"],
  register: ["#0891b2", "#f59e0b", "#14b8a6", "#fbbf24"],
  verify: ["#3b82f6", "#0891b2", "#6366f1", "#8b5cf6"],
  reset: ["#f59e0b", "#0891b2", "#14b8a6", "#fbbf24"],
  success: ["#f59e0b", "#fbbf24", "#fb923c", "#fcd34d"],
  error: ["#ef4444", "#f43f5e", "#ec4899", "#fb7185"],
}

// Generate random orb configurations
function generateOrbs(count: number) {
  return Array.from({ length: count }, (_, i) => ({
    id: i,
    size: 300 + Math.random() * 400, // 300-700px (larger for smoother look)
    x: Math.random() * 100, // % position
    y: Math.random() * 100,
    duration: 25 + Math.random() * 25, // 25-50s animation (slower for smoother)
    delay: Math.random() * -25, // stagger start
  }))
}

export function FloatingOrbs({ state, className }: FloatingOrbsProps) {
  // Generate orbs once on mount
  const orbs = useMemo(() => generateOrbs(6), [])
  const colors = stateColors[state]

  return (
    <div
      className={`fixed inset-0 -z-10 overflow-hidden bg-slate-950 ${className || ""}`}
      aria-hidden="true"
    >
      {/* Base gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-slate-950 to-black" />

      {/* Floating orbs */}
      {orbs.map((orb, index) => (
        <motion.div
          key={orb.id}
          className="absolute rounded-full"
          style={{
            width: orb.size,
            height: orb.size,
            left: `${orb.x}%`,
            top: `${orb.y}%`,
            transform: "translate(-50%, -50%)",
            filter: "blur(100px)",
          }}
          animate={{
            x: [0, 100, -50, 80, 0],
            y: [0, -80, 60, -40, 0],
            scale: [1, 1.2, 0.9, 1.1, 1],
            backgroundColor: colors[index % colors.length],
            opacity: [0.3, 0.5, 0.4, 0.6, 0.3],
          }}
          transition={{
            duration: orb.duration,
            repeat: Infinity,
            ease: "easeInOut",
            delay: orb.delay,
            backgroundColor: { duration: 1, ease: "easeInOut" },
          }}
        />
      ))}

      {/* Soft vignette effect */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_0%,rgba(0,0,0,0.3)_100%)]" />
    </div>
  )
}

export default FloatingOrbs
