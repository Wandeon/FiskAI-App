"use client"

import { motion } from "framer-motion"
import { cn } from "@/lib/utils"

interface AuroraBackgroundProps {
  className?: string
  intensity?: "subtle" | "medium" | "strong"
}

export function AuroraBackground({ className, intensity = "medium" }: AuroraBackgroundProps) {
  const opacityMap = {
    subtle: { base: 0.15, hover: 0.2 },
    medium: { base: 0.25, hover: 0.35 },
    strong: { base: 0.35, hover: 0.45 },
  }

  const opacity = opacityMap[intensity]

  return (
    <div className={cn("pointer-events-none absolute inset-0 overflow-hidden", className)}>
      {/* Primary cyan orb - top left */}
      <motion.div
        className="absolute -left-[10%] -top-[20%] h-[500px] w-[500px] rounded-full bg-accent blur-[120px]"
        style={{ opacity: opacity.base }}
        animate={{
          x: [0, 30, 0],
          y: [0, 20, 0],
          scale: [1, 1.1, 1],
          opacity: [opacity.base, opacity.hover, opacity.base],
        }}
        transition={{
          duration: 15,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      />

      {/* Secondary blue orb - center right */}
      <motion.div
        className="absolute -right-[5%] top-[30%] h-[400px] w-[400px] rounded-full bg-interactive blur-[100px]"
        style={{ opacity: opacity.base }}
        animate={{
          x: [0, -20, 0],
          y: [0, 30, 0],
          scale: [1.1, 1, 1.1],
          opacity: [opacity.base * 0.8, opacity.hover * 0.8, opacity.base * 0.8],
        }}
        transition={{
          duration: 18,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      />

      {/* Tertiary indigo orb - bottom center */}
      <motion.div
        className="absolute bottom-[10%] left-[40%] h-[350px] w-[350px] rounded-full bg-chart-1 blur-[100px]"
        style={{ opacity: opacity.base * 0.7 }}
        animate={{
          x: [0, -40, 0],
          y: [0, -20, 0],
          scale: [1, 1.15, 1],
          opacity: [opacity.base * 0.7, opacity.hover * 0.7, opacity.base * 0.7],
        }}
        transition={{
          duration: 20,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      />

      {/* Small accent orb - adds sparkle */}
      <motion.div
        className="absolute right-[30%] top-[15%] h-[200px] w-[200px] rounded-full bg-accent-light blur-[80px]"
        style={{ opacity: opacity.base * 0.5 }}
        animate={{
          x: [0, 50, 0],
          y: [0, 30, 0],
          opacity: [opacity.base * 0.3, opacity.hover * 0.5, opacity.base * 0.3],
        }}
        transition={{
          duration: 12,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      />
    </div>
  )
}
