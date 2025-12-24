import React from "react"

interface AnnouncerProps {
  message: string
}

export function Announcer({ message }: AnnouncerProps) {
  return (
    <div role="status" aria-live="polite" aria-atomic="true" className="sr-only">
      {message}
    </div>
  )
}
