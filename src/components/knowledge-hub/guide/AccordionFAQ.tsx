"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { ChevronDown, HelpCircle } from "lucide-react"

interface FAQItem {
  question: string
  answer: React.ReactNode
}

interface AccordionFAQProps {
  items: FAQItem[]
  title?: string
  allowMultiple?: boolean
}

function AccordionItem({
  item,
  isOpen,
  onToggle,
  index,
}: {
  item: FAQItem
  isOpen: boolean
  onToggle: () => void
  index: number
}) {
  return (
    <div className="border-b border-white/10 last:border-b-0">
      <button
        onClick={onToggle}
        className="flex w-full items-center justify-between gap-4 py-4 text-left transition-colors hover:text-accent"
        aria-expanded={isOpen}
        aria-controls={`faq-answer-${index}`}
      >
        <span className="text-sm font-medium text-white">{item.question}</span>
        <motion.div
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={{ duration: 0.2 }}
          className="flex-shrink-0"
        >
          <ChevronDown className="h-5 w-5 text-white/70" />
        </motion.div>
      </button>
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            id={`faq-answer-${index}`}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="pb-4 text-sm text-white/70">{item.answer}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export function AccordionFAQ({
  items,
  title = "Često postavljana pitanja",
  allowMultiple = false,
}: AccordionFAQProps) {
  const [openItems, setOpenItems] = useState<Set<number>>(new Set())

  const toggleItem = (index: number) => {
    setOpenItems((prev) => {
      const newSet = new Set(allowMultiple ? prev : [])
      if (prev.has(index)) {
        newSet.delete(index)
      } else {
        newSet.add(index)
      }
      return newSet
    })
  }

  return (
    <div className="my-6 rounded-xl border border-white/10 bg-white/5">
      <div className="flex items-center gap-2 border-b border-white/10 px-6 py-4">
        <HelpCircle className="h-5 w-5 text-accent" />
        <h3 className="text-lg font-semibold text-white">{title}</h3>
        <span className="ml-auto rounded-full bg-white/10 px-2 py-0.5 text-xs font-medium text-white/70">
          {items.length} pitanja
        </span>
      </div>
      <div className="px-6">
        {items.map((item, index) => (
          <AccordionItem
            key={index}
            item={item}
            index={index}
            isOpen={openItems.has(index)}
            onToggle={() => toggleItem(index)}
          />
        ))}
      </div>
    </div>
  )
}

// Also export individual accordion for inline use
export function Accordion({ children, title }: { children: React.ReactNode; title: string }) {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <div className="my-4 rounded-lg border border-white/10 bg-white/5">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex w-full items-center justify-between gap-4 px-4 py-3 text-left transition-colors hover:bg-white/10"
        aria-expanded={isOpen}
      >
        <span className="text-sm font-medium text-white">{title}</span>
        <motion.div animate={{ rotate: isOpen ? 180 : 0 }} transition={{ duration: 0.2 }}>
          <ChevronDown className="h-5 w-5 text-white/70" />
        </motion.div>
      </button>
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="border-t border-white/10 px-4 py-3 text-sm text-white/70">
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
