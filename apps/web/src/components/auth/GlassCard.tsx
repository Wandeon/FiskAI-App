"use client"

import { motion, useMotionValue, useSpring, useTransform } from "framer-motion"
import { useRef, useState, type ReactNode, type MouseEvent } from "react"

interface GlassCardProps {
  children: ReactNode
  className?: string
}

export function GlassCard({ children, className }: GlassCardProps) {
  const cardRef = useRef<HTMLDivElement>(null)
  const [isHovering, setIsHovering] = useState(false)

  // Mouse position relative to card (0,0 = center)
  const mouseX = useMotionValue(0)
  const mouseY = useMotionValue(0)

  // Smooth spring animation for spotlight
  const spotlightX = useSpring(mouseX, { stiffness: 200, damping: 40 })
  const spotlightY = useSpring(mouseY, { stiffness: 200, damping: 40 })

  // Subtle 3D tilt effect
  const rotateX = useTransform(mouseY, [-150, 150], [2, -2])
  const rotateY = useTransform(mouseX, [-200, 200], [-2, 2])

  const handleMouseMove = (e: MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current) return

    const rect = cardRef.current.getBoundingClientRect()
    // Calculate position relative to card's top-left, not center
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top

    mouseX.set(x)
    mouseY.set(y)
  }

  const handleMouseEnter = () => {
    setIsHovering(true)
  }

  const handleMouseLeave = () => {
    // Don't reset position - keep spotlight at last location
    setIsHovering(false)
  }

  return (
    <motion.div
      ref={cardRef}
      onMouseMove={handleMouseMove}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      style={{
        rotateX: isHovering ? rotateX : 0,
        rotateY: isHovering ? rotateY : 0,
        transformStyle: "preserve-3d",
      }}
      className={`relative overflow-hidden rounded-3xl ${className || ""}`}
    >
      {/* Glass background */}
      <div className="absolute inset-0 bg-white/10 backdrop-blur-xl" />

      {/* Gradient border */}
      <div className="absolute inset-0 rounded-3xl border border-white/20" />

      {/* Spotlight glow - outer */}
      <motion.div
        className="pointer-events-none absolute inset-0 rounded-3xl transition-opacity duration-300"
        style={{
          opacity: isHovering ? 1 : 0.5,
          background: useTransform(
            [spotlightX, spotlightY],
            ([x, y]) =>
              `radial-gradient(500px circle at ${x}px ${y}px, rgba(8, 145, 178, 0.15), transparent 60%)`
          ),
        }}
      />

      {/* Inner spotlight (brighter, smaller) */}
      <motion.div
        className="pointer-events-none absolute inset-0 rounded-3xl transition-opacity duration-300"
        style={{
          opacity: isHovering ? 1 : 0.3,
          background: useTransform(
            [spotlightX, spotlightY],
            ([x, y]) =>
              `radial-gradient(250px circle at ${x}px ${y}px, rgba(255, 255, 255, 0.1), transparent 50%)`
          ),
        }}
      />

      {/* Content */}
      <div className="relative z-10 p-8">{children}</div>

      {/* Bottom reflection */}
      <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
    </motion.div>
  )
}

export default GlassCard
