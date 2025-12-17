"use client"

import Link from "next/link"
import { ArrowRight, Scale } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import { GlassCard } from "@/components/ui/patterns/GlassCard"
import { HoverScale } from "@/components/ui/motion/HoverScale"

interface Comparison {
  slug: string
  title: string
  description: string
}

export function ComparisonsExplorer({ comparisons }: { comparisons: Comparison[] }) {
  return (
    <AnimatePresence>
      <div className="mt-10 grid gap-4 sm:grid-cols-2">
        {comparisons.map((comparison, index) => (
          <motion.div
            key={comparison.slug}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1, duration: 0.3 }}
          >
            <HoverScale>
              <Link href={`/usporedba/${comparison.slug}`} className="block">
                <GlassCard className="group flex flex-col h-full p-5">
                  <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-cyan-500/10">
                    <Scale className="h-5 w-5 text-cyan-400" />
                  </div>
                  <h3 className="font-semibold text-white/90 group-hover:text-cyan-400 transition-colors">
                    {comparison.title}
                  </h3>
                  <p className="mt-1 flex-1 text-sm text-white/70">{comparison.description}</p>
                  <div className="mt-4 flex items-center gap-1 text-sm font-medium text-cyan-400">
                    Pročitaj usporedbu
                    <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                  </div>
                </GlassCard>
              </Link>
            </HoverScale>
          </motion.div>
        ))}
      </div>
    </AnimatePresence>
  )
}
