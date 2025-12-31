"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { CheckCircle2, FileText, ScanText, Landmark, Users, Sparkles } from "lucide-react"
import { cn } from "@/lib/utils"
import { AnimatePresence, motion, useReducedMotion } from "framer-motion"
import { DemoExport, DemoInvoice, DemoScan, DemoStatusFlow } from "@/components/marketing/MiniDemos"
import { MarketingVideo } from "@/components/marketing/MarketingMedia"

type FeatureStoryStep = {
  title: string
  subtitle: string
  bullets: string[]
}

type FeatureStoryMedia = {
  videoSrc: string
  posterSrc?: string
}

const DEFAULT_STEPS: FeatureStoryStep[] = [
  {
    title: "Računi u 30 sekundi",
    subtitle: "Predlošci, numeracija i slanje — bez ručnog gubljenja vremena.",
    bullets: [
      "Hrvatski predlošci + obavezni elementi",
      "Statusi i podsjetnici za naplatu",
      "Exporti za knjigovođu (CSV/Excel/PDF)",
    ],
  },
  {
    title: "Troškovi + AI OCR (vi potvrđujete)",
    subtitle: "Skenirajte račun — FiskAI predloži polja i kategoriju, vi imate kontrolu.",
    bullets: ["Unos kamerom ili uploadom", "Istaknuta polja za provjeru", "Auditabilni prijedlozi"],
  },
  {
    title: "E-računi i fiskalizacija 2.0",
    subtitle:
      "Priprema za IE-Račune/posrednike i praćenje statusa e-računa end-to-end. Dolazi uskoro.",
    bullets: [
      "Jedinstveni tok: izrada → slanje → status",
      "Povijest promjena i dokazivost",
      "Manje ručnog rada",
    ],
  },
  {
    title: "Suradnja s knjigovođom bez kaosa",
    subtitle: "Sve uredno, spremno i dijeljivo — bez fascikla i prepisivanja.",
    bullets: ["Izvoz po razdoblju", "ZIP paketi s prilozima", "Jasan audit trag promjena"],
  },
]

function FeaturePreview({
  activeIndex,
  media,
}: {
  activeIndex: number
  media?: Array<FeatureStoryMedia | null | undefined>
}) {
  const reduce = useReducedMotion()
  const previews = useMemo(
    () => [
      {
        kind: "invoice" as const,
        icon: FileText,
        kicker: "Računi",
        title: "Novi račun",
      },
      {
        kind: "scan" as const,
        icon: ScanText,
        kicker: "Troškovi",
        title: "OCR rezultat",
      },
      {
        kind: "status" as const,
        icon: Landmark,
        kicker: "E-računi",
        title: "Statusni tok",
      },
      {
        kind: "export" as const,
        icon: Users,
        kicker: "Knjigovođa",
        title: "Paket za izvoz",
      },
    ],
    []
  )

  const index = Math.min(previews.length - 1, Math.max(0, activeIndex))
  const preview = previews[index]
  const activeMedia = media?.[index] ?? null
  const Icon = preview.icon
  const shellTransition = reduce
    ? { duration: 0 }
    : { duration: 0.35, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] }

  return (
    <div className="relative overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-card">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(600px_circle_at_0%_0%,rgba(59,130,246,0.18),transparent_60%),radial-gradient(500px_circle_at_100%_10%,rgba(99,102,241,0.16),transparent_55%)]" />
      <div className="relative p-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-interactive-secondary text-interactive flex items-center justify-center">
              <Sparkles className="h-4 w-4" />
            </div>
            <p className="text-xs font-semibold text-[var(--muted)]">FiskAI • Feature demo</p>
          </div>
          <div className="flex gap-1">
            <span className="h-2 w-2 rounded-full bg-danger/80" />
            <span className="h-2 w-2 rounded-full bg-warning/80" />
            <span className="h-2 w-2 rounded-full bg-success/80" />
          </div>
        </div>

        <div className="relative mt-5 h-[280px]">
          <AnimatePresence mode="wait">
            <motion.div
              key={preview.kind}
              initial={reduce ? false : { opacity: 0, y: 10 }}
              animate={reduce ? undefined : { opacity: 1, y: 0 }}
              exit={reduce ? undefined : { opacity: 0, y: -10 }}
              transition={shellTransition}
              className="absolute inset-0 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 h-10 w-10 rounded-xl bg-interactive-secondary text-interactive flex items-center justify-center">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-interactive">{preview.kicker}</p>
                    <p className="text-sm font-semibold">{preview.title}</p>
                  </div>
                </div>
                <span className="rounded-full border border-[var(--border)] bg-[var(--surface-secondary)] px-2 py-1 text-[10px] font-semibold text-[var(--muted)]">
                  demo
                </span>
              </div>

              <div className="mt-4">
                {activeMedia?.videoSrc ? (
                  <div className="relative h-[200px] overflow-hidden rounded-lg border border-[var(--border)] bg-black/5">
                    <MarketingVideo
                      src={activeMedia.videoSrc}
                      poster={activeMedia.posterSrc}
                      label={`FiskAI demo: ${preview.title}`}
                      className="rounded-none"
                    />
                  </div>
                ) : (
                  <>
                    {preview.kind === "invoice" && <DemoInvoice reduce={!!reduce} />}
                    {preview.kind === "scan" && <DemoScan reduce={!!reduce} />}
                    {preview.kind === "status" && <DemoStatusFlow reduce={!!reduce} />}
                    {preview.kind === "export" && <DemoExport reduce={!!reduce} />}
                  </>
                )}
              </div>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  )
}

export function FeatureStoryScroller({
  steps = DEFAULT_STEPS,
  media,
  className,
}: {
  steps?: FeatureStoryStep[]
  media?: Array<FeatureStoryMedia | null | undefined>
  className?: string
}) {
  const [activeIndex, setActiveIndex] = useState(0)
  const stepRefs = useRef<Array<HTMLDivElement | null>>([])

  useEffect(() => {
    const prefersReduced =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => (b.intersectionRatio ?? 0) - (a.intersectionRatio ?? 0))[0]

        if (!visible) return
        const index = Number(visible.target.getAttribute("data-step-index"))
        if (Number.isFinite(index)) setActiveIndex(index)
      },
      {
        root: null,
        threshold: prefersReduced ? 0.6 : [0.2, 0.35, 0.5, 0.65, 0.8],
        rootMargin: "-20% 0px -55% 0px",
      }
    )

    stepRefs.current.forEach((el) => {
      if (el) observer.observe(el)
    })

    return () => observer.disconnect()
  }, [])

  return (
    <div className={cn("grid gap-8 md:grid-cols-[minmax(0,1fr)_420px] md:items-start", className)}>
      <div className="space-y-4">
        {steps.map((step, index) => {
          const isActive = index === activeIndex
          return (
            <div
              key={step.title}
              ref={(el) => {
                stepRefs.current[index] = el
              }}
              data-step-index={index}
              className={cn(
                "rounded-2xl border p-6 transition-colors",
                isActive
                  ? "border-info-border bg-info-bg"
                  : "border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--surface-secondary)]"
              )}
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold text-interactive">Feature {index + 1}</p>
                  <h3 className="mt-1 text-lg font-semibold">{step.title}</h3>
                  <p className="mt-1 text-sm text-[var(--muted)]">{step.subtitle}</p>
                </div>
                <div
                  className={cn(
                    "flex h-10 w-10 items-center justify-center rounded-xl border text-sm font-bold",
                    isActive
                      ? "border-info-border bg-surface text-interactive"
                      : "border-[var(--border)] bg-[var(--surface)] text-[var(--muted)]"
                  )}
                >
                  {index + 1}
                </div>
              </div>
              <ul className="mt-4 space-y-2 text-sm text-[var(--muted)]">
                {step.bullets.map((bullet) => (
                  <li key={bullet} className="flex items-start gap-2">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 text-interactive" />
                    <span>{bullet}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-5 md:hidden">
                <FeaturePreview activeIndex={index} media={media} />
              </div>
            </div>
          )
        })}
      </div>

      <div className="hidden md:block md:sticky md:top-24">
        <FeaturePreview activeIndex={activeIndex} media={media} />
        <div className="mt-4 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
          <p className="text-sm font-semibold">Zašto ovo izgleda “premium”?</p>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Kombiniramo animacije, jasne informacije i “show, don’t tell” mikro-demo elemente tako
            da posjetitelj odmah razumije vrijednost — bez čitanja zidova teksta.
          </p>
        </div>
      </div>
    </div>
  )
}
