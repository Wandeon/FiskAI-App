"use client"

import { motion, useReducedMotion } from "framer-motion"
import { cn } from "@/lib/utils"

interface GlowOrbProps {
  color?: "blue" | "cyan" | "indigo" | "purple"
  size?: "sm" | "md" | "lg"
  className?: string
  animation?: "pulse" | "float" | "drift"
}

const colorMap = {
  blue: "bg-interactive/20 blur-[120px]",
  cyan: "bg-accent/10 blur-[80px]",
  indigo: "bg-chart-1/15 blur-[100px]",
  purple: "bg-chart-2/15 blur-[100px]",
}

const sizeMap = {
  sm: "h-[300px] w-[300px]",
  md: "h-[400px] w-[400px]",
  lg: "h-[500px] w-[500px]",
}

const animationVariants = {
  pulse: {
    animate: {
      scale: [1, 1.2, 1],
      opacity: [0.2, 0.3, 0.2],
    },
    transition: {
      duration: 8,
      repeat: Infinity,
      ease: "easeInOut" as const,
    },
  },
  float: {
    animate: {
      y: [0, -30, 0],
      opacity: [0.15, 0.25, 0.15],
    },
    transition: {
      duration: 10,
      repeat: Infinity,
      ease: "easeInOut" as const,
    },
  },
  drift: {
    animate: {
      x: [0, 50, 0],
      opacity: [0.1, 0.2, 0.1],
    },
    transition: {
      duration: 12,
      repeat: Infinity,
      ease: "easeInOut" as const,
    },
  },
}

export function GlowOrb({
  color = "blue",
  size = "md",
  className,
  animation = "pulse",
}: GlowOrbProps) {
  const reduce = useReducedMotion()

  const colorClass = colorMap[color]
  const sizeClass = sizeMap[size]
  const animationConfig = animationVariants[animation]

  // If reduced motion, render static orb
  if (reduce) {
    return <div className={cn("rounded-full", colorClass, sizeClass, className)} />
  }

  // Otherwise use motion.div with animation
  return (
    <motion.div
      className={cn("rounded-full", colorClass, sizeClass, className)}
      animate={animationConfig.animate}
      transition={animationConfig.transition}
    />
  )
}
