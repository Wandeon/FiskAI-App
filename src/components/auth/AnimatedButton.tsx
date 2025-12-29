// src/components/auth/AnimatedButton.tsx
"use client"

import { motion, AnimatePresence, type HTMLMotionProps } from "framer-motion"
import { forwardRef } from "react"
import { cn } from "@/lib/utils"

type ButtonState = "idle" | "loading" | "success" | "error"

// Omit conflicting event types from HTML button attributes
type MotionButtonProps = Omit<
  HTMLMotionProps<"button">,
  "onAnimationStart" | "onDragStart" | "onDragEnd" | "onDrag"
>

interface AnimatedButtonProps extends MotionButtonProps {
  state?: ButtonState
  children: React.ReactNode
}

const CheckIcon = () => (
  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
    <motion.path
      initial={{ pathLength: 0 }}
      animate={{ pathLength: 1 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M5 13l4 4L19 7"
    />
  </svg>
)

const Spinner = () => (
  <motion.div
    className="h-5 w-5 border-2 border-white/30 border-t-white rounded-full"
    animate={{ rotate: 360 }}
    transition={{ duration: 0.8, repeat: Infinity, ease: "linear" }}
  />
)

export const AnimatedButton = forwardRef<HTMLButtonElement, AnimatedButtonProps>(
  ({ className, state = "idle", children, disabled, ...props }, ref) => {
    const isDisabled = disabled || state === "loading"

    return (
      <motion.button
        ref={ref}
        className={cn(
          "relative inline-flex h-12 w-full items-center justify-center rounded-xl font-semibold text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 focus-visible:ring-offset-2 disabled:pointer-events-none",
          state === "success" ? "bg-chart-4" : "bg-cyan-600 hover:bg-cyan-700",
          state === "error" && "bg-danger",
          className
        )}
        whileHover={state === "idle" ? { scale: 1.02 } : undefined}
        whileTap={state === "idle" ? { scale: 0.98 } : undefined}
        disabled={isDisabled}
        {...props}
      >
        <AnimatePresence mode="wait">
          {state === "loading" && (
            <motion.span
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
            >
              <Spinner />
            </motion.span>
          )}
          {state === "success" && (
            <motion.span
              key="success"
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              transition={{ type: "spring", stiffness: 300, damping: 20 }}
            >
              <CheckIcon />
            </motion.span>
          )}
          {(state === "idle" || state === "error") && (
            <motion.span
              key="content"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
            >
              {children}
            </motion.span>
          )}
        </AnimatePresence>
      </motion.button>
    )
  }
)

AnimatedButton.displayName = "AnimatedButton"

export default AnimatedButton
