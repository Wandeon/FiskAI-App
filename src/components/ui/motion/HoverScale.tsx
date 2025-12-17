"use client"

import { motion, useReducedMotion, type HTMLMotionProps } from "framer-motion"
import { cn } from "@/lib/utils"

interface HoverScaleProps extends HTMLMotionProps<"div"> {
  children: React.ReactNode
  scale?: number // default 1.02
  tapScale?: number // default 0.98
  className?: string
}

export function HoverScale({
  children,
  scale = 1.02,
  tapScale = 0.98,
  className,
  ...props
}: HoverScaleProps) {
  const reduce = useReducedMotion()

  // If reduced motion, render without animation
  if (reduce) {
    return (
      <div className={cn(className)} {...(props as React.HTMLAttributes<HTMLDivElement>)}>
        {children}
      </div>
    )
  }

  // Otherwise use motion.div with hover and tap animations
  return (
    <motion.div
      className={cn(className)}
      whileHover={{ scale }}
      whileTap={{ scale: tapScale }}
      transition={{ type: "spring", stiffness: 400, damping: 25 }}
      {...props}
    >
      {children}
    </motion.div>
  )
}
