"use client"

import { useState, useRef, useEffect } from "react"
import {
  Send,
  Sparkles,
  User,
  Bot,
  Loader2,
  ArrowRight,
  X,
  MessageSquare,
  Minimize2,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import { AnimatePresence, motion } from "framer-motion"

interface Message {
  role: "user" | "assistant"
  content: string
}

const SUGGESTED_QUESTIONS = [
  "Kako izdati novi račun?",
  "Koji je limit za paušalni obrt?",
  "Kako unijeti novi trošak?",
  "Obveze fiskalizacije?",
]

export function AssistantPopup() {
  const [isOpen, setIsOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  useEffect(() => {
    if (isOpen) {
      scrollToBottom()
    }
  }, [messages, isOpen])

  // Listen for global open events
  useEffect(() => {
    const handleOpen = () => setIsOpen(true)
    window.addEventListener("open-assistant", handleOpen)
    return () => window.removeEventListener("open-assistant", handleOpen)
  }, [])

  const handleSendMessage = async (e?: React.FormEvent, suggestion?: string) => {
    e?.preventDefault()
    const textToSend = suggestion || input.trim()

    if (!textToSend || isLoading) return

    // Add user message immediately
    const newMessages: Message[] = [...messages, { role: "user", content: textToSend }]
    setMessages(newMessages)
    setInput("")
    setIsLoading(true)

    try {
      const response = await fetch("/api/assistant/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ messages: newMessages }),
      })

      if (!response.ok) throw new Error("Network response was not ok")
      if (!response.body) throw new Error("No response body")

      // Initialize empty assistant message
      setMessages((prev) => [...prev, { role: "assistant", content: "" }])

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let done = false
      let assistantResponse = ""

      while (!done) {
        const { value, done: doneReading } = await reader.read()
        done = doneReading
        if (value) {
          const chunk = decoder.decode(value, { stream: true })
          assistantResponse += chunk

          // Update the last message (assistant's) with the new chunk
          setMessages((prev) => {
            const updated = [...prev]
            updated[updated.length - 1] = { role: "assistant", content: assistantResponse }
            return updated
          })
        }
      }
    } catch (error) {
      console.error("Failed to send message:", error)
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "Ispričavam se, došlo je do greške u komunikaciji. Molim pokušajte ponovno.",
        },
      ])
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="fixed bottom-20 right-4 md:right-6 w-[90vw] md:w-[400px] h-[600px] max-h-[80vh] bg-[var(--surface)] border border-[var(--border)] rounded-2xl shadow-xl z-50 flex flex-col overflow-hidden glass-card"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-border bg-surface-2 text-foreground">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-interactive/20 flex items-center justify-center border border-interactive/30">
                  <Sparkles className="w-4 h-4 text-interactive" />
                </div>
                <div>
                  <h3 className="font-semibold text-sm">FiskAI Asistent</h3>
                  <p className="text-xs text-interactive">Online</p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0 text-tertiary hover:text-foreground hover:bg-surface-1"
                  onClick={() => setIsOpen(false)}
                >
                  <Minimize2 className="w-4 h-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0 text-tertiary hover:text-foreground hover:bg-surface-1"
                  onClick={() => setIsOpen(false)}
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </div>

            {/* Chat Body */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-[var(--surface-secondary)]/30 scrollbar-thin">
              {messages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-4 opacity-70">
                  <div className="w-12 h-12 rounded-full bg-info-bg text-info-text flex items-center justify-center mb-3">
                    <Sparkles className="w-6 h-6" />
                  </div>
                  <p className="text-sm font-medium mb-6">
                    Pozdrav! Ja sam vaš AI asistent. Kako vam mogu pomoći s poslovanjem danas?
                  </p>
                  <div className="grid gap-2 w-full">
                    {SUGGESTED_QUESTIONS.map((q) => (
                      <button
                        key={q}
                        onClick={() => handleSendMessage(undefined, q)}
                        className="text-xs text-left p-2.5 rounded-lg bg-surface border border-border hover:border-interactive/50 hover:bg-info-bg/50 transition-all"
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                messages.map((m, i) => (
                  <div
                    key={i}
                    className={cn(
                      "flex gap-2 max-w-[85%]",
                      m.role === "user" ? "ml-auto flex-row-reverse" : "mr-auto"
                    )}
                  >
                    <div
                      className={cn(
                        "w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 text-[10px]",
                        m.role === "user"
                          ? "bg-interactive text-white hidden"
                          : "bg-success text-white"
                      )}
                    >
                      {m.role === "assistant" && <Bot className="w-3 h-3" />}
                    </div>
                    <div
                      className={cn(
                        "p-3 text-sm leading-relaxed whitespace-pre-wrap shadow-sm",
                        m.role === "user"
                          ? "bg-interactive text-white rounded-2xl rounded-tr-sm"
                          : "bg-surface text-foreground border border-border rounded-2xl rounded-tl-sm"
                      )}
                    >
                      {m.content}
                    </div>
                  </div>
                ))
              )}
              {isLoading && (
                <div className="flex gap-2 max-w-[85%] mr-auto">
                  <div className="w-6 h-6 rounded-full bg-success text-white flex items-center justify-center flex-shrink-0">
                    <Bot className="w-3 h-3" />
                  </div>
                  <div className="bg-surface border border-border px-3 py-2 rounded-2xl rounded-tl-sm flex items-center gap-2">
                    <div className="flex gap-1">
                      <span className="w-1.5 h-1.5 bg-muted rounded-full animate-bounce [animation-delay:-0.3s]"></span>
                      <span className="w-1.5 h-1.5 bg-muted rounded-full animate-bounce [animation-delay:-0.15s]"></span>
                      <span className="w-1.5 h-1.5 bg-muted rounded-full animate-bounce"></span>
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div className="p-3 bg-surface border-t border-border">
              <form onSubmit={handleSendMessage} className="flex gap-2 items-center">
                <Input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Upišite pitanje..."
                  className="flex-1 h-10 bg-surface-1/50 border-transparent focus:bg-surface focus:border-focus transition-all"
                  disabled={isLoading}
                />
                <Button
                  type="submit"
                  disabled={!input.trim() || isLoading}
                  size="sm"
                  className={cn(
                    "h-10 w-10 p-0 rounded-full transition-all",
                    input.trim()
                      ? "bg-interactive hover:bg-interactive-hover shadow-lg shadow-interactive/20"
                      : "bg-surface-2 text-muted"
                  )}
                >
                  <Send className="w-4 h-4 ml-0.5" />
                </Button>
              </form>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Floating Button (FAB) */}
      <motion.button
        onClick={() => setIsOpen(!isOpen)}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        className={cn(
          "fixed bottom-6 right-6 z-50 flex items-center justify-center w-14 h-14 rounded-full shadow-lg transition-all duration-300",
          isOpen
            ? "bg-surface-2 text-foreground rotate-90"
            : "bg-gradient-to-r from-interactive to-interactive-hover text-white hover:shadow-interactive/30"
        )}
      >
        {isOpen ? <X className="w-6 h-6" /> : <MessageSquare className="w-6 h-6" />}

        {/* Notification dot (optional) */}
        {!isOpen && messages.length > 0 && (
          <span className="absolute top-0 right-0 w-4 h-4 bg-danger border-2 border-base rounded-full"></span>
        )}
      </motion.button>
    </>
  )
}
