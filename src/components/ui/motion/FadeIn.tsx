"use client"

import { motion, useReducedMotion } from "framer-motion"
import { cn } from "@/lib/utils"

interface FadeInProps {
  children: React.ReactNode
  delay?: number // default 0
  duration?: number // default 0.4
  className?: string
  once?: boolean // default true - only animate once when in view
}

export function FadeIn({
  children,
  delay = 0,
  duration = 0.4,
  className,
  once = true,
}: FadeInProps) {
  const reduce = useReducedMotion()

  // If reduced motion, render without animation
  if (reduce) {
    return <div className={cn(className)}>{children}</div>
  }

  // Otherwise use motion.div with fade animation
  return (
    <motion.div
      className={cn(className)}
      initial={{ opacity: 0 }}
      whileInView={{ opacity: 1 }}
      viewport={{ once }}
      transition={{ duration, delay }}
    >
      {children}
    </motion.div>
  )
}
