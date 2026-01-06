"use client"

import { useState } from "react"
import { Share2, Check, Twitter, Linkedin, Facebook, Link2 } from "lucide-react"

interface SocialShareProps {
  url: string
  title: string
  description?: string
}

export function SocialShare({ url, title, description }: SocialShareProps) {
  const [copied, setCopied] = useState(false)

  const encodedUrl = encodeURIComponent(url)
  const encodedTitle = encodeURIComponent(title)
  const encodedDescription = encodeURIComponent(description || "")

  const shareLinks = {
    twitter: `https://twitter.com/intent/tweet?url=${encodedUrl}&text=${encodedTitle}`,
    linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`,
    facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}&quote=${encodedTitle}`,
  }

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Fallback for older browsers
      const textArea = document.createElement("textarea")
      textArea.value = url
      document.body.appendChild(textArea)
      textArea.select()
      document.execCommand("copy")
      document.body.removeChild(textArea)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const buttonBaseClass =
    "flex h-10 w-10 items-center justify-center rounded-lg border border-white/10 bg-surface/5 transition-all hover:border-white/20 hover:bg-surface/10"

  return (
    <div className="flex items-center gap-3">
      <div className="flex items-center gap-2 text-sm text-white/60">
        <Share2 className="h-4 w-4" />
        <span>Podijeli:</span>
      </div>
      <div className="flex items-center gap-2">
        {/* Twitter/X */}
        <a
          href={shareLinks.twitter}
          target="_blank"
          rel="noopener noreferrer"
          className={buttonBaseClass}
          aria-label="Podijeli na X (Twitter)"
          title="Podijeli na X (Twitter)"
        >
          <Twitter className="h-4 w-4 text-white/70 hover:text-white" />
        </a>

        {/* LinkedIn */}
        <a
          href={shareLinks.linkedin}
          target="_blank"
          rel="noopener noreferrer"
          className={buttonBaseClass}
          aria-label="Podijeli na LinkedIn"
          title="Podijeli na LinkedIn"
        >
          <Linkedin className="h-4 w-4 text-white/70 hover:text-white" />
        </a>

        {/* Facebook */}
        <a
          href={shareLinks.facebook}
          target="_blank"
          rel="noopener noreferrer"
          className={buttonBaseClass}
          aria-label="Podijeli na Facebook"
          title="Podijeli na Facebook"
        >
          <Facebook className="h-4 w-4 text-white/70 hover:text-white" />
        </a>

        {/* Copy Link */}
        <button
          onClick={copyToClipboard}
          className={`${buttonBaseClass} ${copied ? "border-success/50 bg-chart-4/20" : ""}`}
          aria-label={copied ? "Link kopiran" : "Kopiraj link"}
          title={copied ? "Link kopiran!" : "Kopiraj link"}
        >
          {copied ? (
            <Check className="h-4 w-4 text-success" />
          ) : (
            <Link2 className="h-4 w-4 text-white/70 hover:text-white" />
          )}
        </button>
      </div>
    </div>
  )
}
