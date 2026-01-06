import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { cn } from "@/lib/utils"

interface NewsMarkdownProps {
  content: string
  className?: string
}

export function NewsMarkdown({ content, className }: NewsMarkdownProps) {
  return (
    <div
      className={cn(
        "prose prose-invert max-w-none prose-headings:text-white prose-p:text-white/80 prose-a:text-link prose-strong:text-white prose-code:text-info-text prose-pre:border prose-pre:border-white/10 prose-pre:bg-surface/5",
        className
      )}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        skipHtml
        components={{
          a({ href, className: anchorClassName, ...props }) {
            const isExternal = typeof href === "string" && /^https?:\/\//.test(href)

            return (
              <a
                href={href}
                target={isExternal ? "_blank" : undefined}
                rel={isExternal ? "noopener noreferrer" : undefined}
                className={cn(
                  "text-link underline decoration-white/20 underline-offset-4 hover:text-info-text",
                  anchorClassName
                )}
                {...props}
              />
            )
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
}
