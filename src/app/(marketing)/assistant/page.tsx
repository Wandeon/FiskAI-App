"use client"

import { useSearchParams } from "next/navigation"
import { Suspense } from "react"
import { motion } from "framer-motion"
import { PlexusBackground } from "@/components/marketing/PlexusBackground"
import { AssistantContainer } from "@/components/assistant-v2"

function AssistantPageContent() {
  const searchParams = useSearchParams()
  const initialQuery = searchParams.get("q") || undefined
  const source = searchParams.get("src") || undefined

  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-br from-base via-interactive/30 to-base">
      {/* Animated background effects */}
      <PlexusBackground className="opacity-30" />

      {/* Animated glow orbs */}
      <div className="pointer-events-none absolute inset-0">
        <motion.div
          className="absolute left-[15%] top-[20%] h-[400px] w-[400px] rounded-full bg-interactive/20 blur-[120px]"
          animate={{
            scale: [1, 1.15, 1],
            opacity: [0.15, 0.25, 0.15],
          }}
          transition={{
            duration: 8,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
        <motion.div
          className="absolute right-[10%] top-[30%] h-[350px] w-[350px] rounded-full bg-primary/15 blur-[100px]"
          animate={{
            scale: [1.1, 1, 1.1],
            opacity: [0.1, 0.2, 0.1],
          }}
          transition={{
            duration: 10,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
        <motion.div
          className="absolute bottom-[20%] left-[40%] h-[300px] w-[300px] rounded-full bg-chart-1/10 blur-[80px]"
          animate={{
            x: [0, 30, 0],
            opacity: [0.1, 0.15, 0.1],
          }}
          transition={{
            duration: 12,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
      </div>

      {/* Grid overlay for tech feel */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: `linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px),
                            linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)`,
          backgroundSize: "50px 50px",
        }}
      />

      {/* Content */}
      <div className="relative mx-auto max-w-3xl px-4 py-16 md:px-6 md:py-24">
        {/* Header */}
        <header className="mb-12 text-center">
          <motion.h1
            className="text-4xl font-bold leading-tight text-white md:text-5xl"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <span className="block">Regulatorni</span>
            <motion.span
              className="block bg-gradient-to-r from-primary via-interactive to-interactive-hover bg-clip-text text-transparent"
              animate={{
                backgroundPosition: ["0% 50%", "100% 50%", "0% 50%"],
              }}
              transition={{
                duration: 5,
                repeat: Infinity,
                ease: "linear",
              }}
              style={{ backgroundSize: "200% 200%" }}
            >
              Asistent
            </motion.span>
          </motion.h1>
          <motion.p
            className="mt-4 text-lg text-white/60"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
          >
            Svaki odgovor potkrije službenim izvorima. Bez nagađanja.
          </motion.p>
        </header>

        {/* Assistant Container */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
        >
          <AssistantContainer
            surface="MARKETING"
            variant="dark"
            initialQuery={initialQuery}
            source={source}
          />
        </motion.div>
      </div>
    </div>
  )
}

export default function MarketingAssistantPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-gradient-to-br from-base via-interactive/30 to-base" />
      }
    >
      <AssistantPageContent />
    </Suspense>
  )
}
