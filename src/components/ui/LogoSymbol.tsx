import React from "react"

interface LogoProps extends React.SVGProps<SVGSVGElement> {
  className?: string
}

export const FiskAILogo = ({ className, ...props }: LogoProps) => {
  return (
    <svg
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      {...props}
    >
      {/* Vertical Spine - Represents the Foundation/Audit Log */}
      <rect x="10" y="8" width="14" height="48" rx="4" fill="currentColor" />

      {/* Top Arm - Represents Input/Data */}
      <rect x="28" y="8" width="28" height="14" rx="4" fill="currentColor" />

      {/* Middle Arm - Represents Intelligence/Processing */}
      <rect x="28" y="26" width="18" height="14" rx="4" fill="currentColor" />
    </svg>
  )
}

export default FiskAILogo
