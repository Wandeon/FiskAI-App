// src/components/knowledge-hub/guide/FAQ.tsx
"use client"

import { useId, useMemo, useState } from "react"
import { AnimatePresence, motion, useReducedMotion } from "framer-motion"
import { ChevronDown } from "lucide-react"
import { cn } from "@/lib/utils"

type FAQItem = {
  question: string
  answer: string | React.ReactNode
}

interface FAQProps {
  items?: FAQItem[]
  question?: string
  children?: React.ReactNode
  defaultOpenIndex?: number
  defaultOpen?: boolean
  className?: string
}

function normalizeItems(props: FAQProps): FAQItem[] {
  if (props.items?.length) return props.items
  if (props.question && props.children != null) {
    return [{ question: props.question, answer: props.children }]
  }
  return []
}

export function FAQ({
  items,
  question,
  children,
  defaultOpenIndex,
  defaultOpen,
  className,
}: FAQProps) {
  const reduce = useReducedMotion()
  const baseId = useId()
  const resolvedItems = useMemo(
    () => normalizeItems({ items, question, children }),
    [children, items, question]
  )

  const [openIndex, setOpenIndex] = useState<number | null>(() => {
    if (typeof defaultOpenIndex === "number") return defaultOpenIndex
    if (resolvedItems.length === 1 && defaultOpen) return 0
    return null
  })

  if (resolvedItems.length === 0) return null

  return (
    <div
      className={cn(
        "not-prose my-6 overflow-hidden rounded-2xl border border-white/10 bg-white/5",
        className
      )}
    >
      <ul className="divide-y divide-white/10">
        {resolvedItems.map((item, index) => {
          const isOpen = openIndex === index
          const buttonId = `${baseId}-faq-button-${index}`
          const panelId = `${baseId}-faq-panel-${index}`

          return (
            <li key={`${item.question}-${index}`} className="group">
              <button
                id={buttonId}
                type="button"
                aria-expanded={isOpen}
                aria-controls={panelId}
                onClick={() => setOpenIndex(isOpen ? null : index)}
                className="flex w-full items-start justify-between gap-4 px-5 py-4 text-left transition-colors hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus/30"
              >
                <span className="text-sm font-semibold text-white">{item.question}</span>
                <motion.span
                  aria-hidden="true"
                  animate={reduce ? undefined : { rotate: isOpen ? 180 : 0 }}
                  transition={reduce ? { duration: 0 } : { duration: 0.2, ease: "easeOut" }}
                  className="mt-0.5 inline-flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/10 text-white/70 transition-colors group-hover:bg-white/20"
                >
                  <ChevronDown className="h-4 w-4" />
                </motion.span>
              </button>

              <AnimatePresence initial={false}>
                {isOpen && (
                  <motion.div
                    key={panelId}
                    id={panelId}
                    role="region"
                    aria-labelledby={buttonId}
                    initial={reduce ? false : { height: 0, opacity: 0 }}
                    animate={reduce ? undefined : { height: "auto", opacity: 1 }}
                    exit={reduce ? undefined : { height: 0, opacity: 0 }}
                    transition={
                      reduce ? { duration: 0 } : { duration: 0.24, ease: [0.16, 1, 0.3, 1] }
                    }
                    className="overflow-hidden"
                  >
                    <div className="px-5 pb-5 text-sm leading-relaxed text-white/70">
                      {typeof item.answer === "string" ? (
                        <p className="m-0">{item.answer}</p>
                      ) : (
                        item.answer
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
