"use client"

import { FiskAILogo } from "./LogoSymbol"

interface LoadingStateProps {
  size?: "sm" | "md" | "lg"
  text?: string
}

export const LoadingState = ({ size = "md", text }: LoadingStateProps) => {
  const sizes = {
    sm: "w-8 h-8",
    md: "w-12 h-12",
    lg: "w-16 h-16",
  }

  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-4">
      <div className="relative">
        {/* Base Logo */}
        <FiskAILogo className={`${sizes[size]} text-foreground`} />
        {/* Overlay Logo that pulses */}
        <div className="absolute inset-0 animate-pulse">
          <FiskAILogo className={`${sizes[size]} text-cyan-500 opacity-60`} />
        </div>
      </div>
      {text && <p className="text-sm text-tertiary animate-pulse">{text}</p>}
    </div>
  )
}

export default LoadingState
