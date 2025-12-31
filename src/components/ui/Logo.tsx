"use client"

import React from "react"
import { FiskAILogo } from "./LogoSymbol"

interface LogoProps {
  showBeta?: boolean
  size?: "sm" | "md" | "lg"
  variant?: "default" | "white"
}

export const Logo = ({ showBeta = true, size = "md", variant = "default" }: LogoProps) => {
  const sizes = {
    sm: { icon: "w-6 h-6", text: "text-lg", beta: "text-[8px]" },
    md: { icon: "w-8 h-8", text: "text-xl", beta: "text-[10px]" },
    lg: { icon: "w-10 h-10", text: "text-2xl", beta: "text-[11px]" },
  }

  const s = sizes[size]

  return (
    <div className="flex items-center gap-2 group">
      {/* The Symbol: Cyan by default, subtle glow on hover */}
      <div className="relative flex items-center justify-center">
        <FiskAILogo
          className={`${s.icon} text-cyan-500 transition-all duration-300 group-hover:brightness-110`}
        />
        {/* Subtle backdrop glow for dark mode */}
        <div className="absolute inset-0 bg-accent/20 blur-lg rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
      </div>

      {/* The Wordmark */}
      <div className="flex flex-col justify-center -space-y-0.5">
        <span
          className={`${s.text} font-bold tracking-tight leading-none ${
            variant === "white" ? "text-white" : "text-white"
          }`}
        >
          Fisk<span className="text-cyan-500">AI</span>
        </span>
        {showBeta && (
          <span
            className={`${s.beta} uppercase tracking-widest font-medium leading-none ${
              variant === "white" ? "text-white/50" : "text-tertiary"
            }`}
          >
            Beta
          </span>
        )}
      </div>
    </div>
  )
}

export default Logo
