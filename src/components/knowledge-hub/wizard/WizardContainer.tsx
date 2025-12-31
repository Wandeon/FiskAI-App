// src/components/knowledge-hub/wizard/WizardContainer.tsx
"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { WIZARD_QUESTIONS, getWizardResult } from "@/lib/knowledge-hub/wizard-logic"
import { WizardAnswer } from "@/lib/knowledge-hub/types"
import { useVisitorStore } from "@/stores/visitor-store"
import {
  ArrowLeft,
  ArrowRight,
  BarChart3,
  BriefcaseBusiness,
  Coffee,
  Code2,
  GraduationCap,
  Layers,
  Loader2,
  Palette,
  Search,
  ShoppingBag,
  Shapes,
  Target,
  TrendingDown,
  TrendingUp,
  Users,
} from "lucide-react"
import { AnimatePresence, motion, useReducedMotion } from "framer-motion"
import { cn } from "@/lib/utils"

function getOptionIcon(questionId: string, value: string) {
  if (questionId === "employment") {
    if (value === "employed") return BriefcaseBusiness
    if (value === "unemployed") return Search
    if (value === "retired") return Coffee
    if (value === "student") return GraduationCap
  }

  if (questionId === "intent") {
    if (value === "side") return Layers
    if (value === "main") return Target
    if (value === "partners") return Users
  }

  if (questionId === "revenue") {
    if (value === "low") return TrendingDown
    if (value === "medium") return BarChart3
    if (value === "high") return TrendingUp
  }

  if (questionId === "activity") {
    if (value === "it") return Code2
    if (value === "kreativa") return Palette
    if (value === "trgovina") return ShoppingBag
    if (value === "ostalo") return Shapes
  }

  return Shapes
}

export function WizardContainer() {
  const router = useRouter()
  const reduce = useReducedMotion()
  const { saveWizardAnswers, setStage } = useVisitorStore()
  const [currentQuestionId, setCurrentQuestionId] = useState("employment")
  const [answers, setAnswers] = useState<WizardAnswer[]>([])
  const [selectedValue, setSelectedValue] = useState<string | null>(null)
  const [questionHistory, setQuestionHistory] = useState<string[]>(["employment"])
  const [direction, setDirection] = useState<1 | -1>(1)
  const [isThinking, setIsThinking] = useState(false)
  const timeoutRef = useRef<number | null>(null)

  const currentQuestion = WIZARD_QUESTIONS[currentQuestionId]

  const handleNext = () => {
    if (!selectedValue || isThinking) return
    setIsThinking(true)
    setDirection(1)

    timeoutRef.current = window.setTimeout(() => {
      const newAnswers = [
        ...answers.filter((a) => a.questionId !== currentQuestionId),
        { questionId: currentQuestionId, value: selectedValue },
      ]
      setAnswers(newAnswers)

      const nextId = currentQuestion.nextQuestion(selectedValue, newAnswers)

      if (nextId) {
        setCurrentQuestionId(nextId)
        setQuestionHistory((prev) => [...prev, nextId])
        setSelectedValue(null)
      } else {
        // Store wizard answers in visitor store for later use in onboarding
        const wizardData: Record<string, string> = {}
        newAnswers.forEach((answer) => {
          wizardData[answer.questionId] = answer.value
        })
        saveWizardAnswers(wizardData)
        setStage("recommendation")

        const result = getWizardResult(newAnswers)
        const url = result.params ? `${result.path}?${result.params.toString()}` : result.path
        router.push(url)
      }

      setIsThinking(false)
    }, 300)
  }

  const handleBack = () => {
    if (questionHistory.length <= 1 || isThinking) return
    setDirection(-1)

    // Remove current question from history
    const newHistory = questionHistory.slice(0, -1)
    const previousQuestionId = newHistory[newHistory.length - 1]

    setQuestionHistory(newHistory)
    setCurrentQuestionId(previousQuestionId)

    // Restore previous answer
    const prevAnswer = answers.find((a) => a.questionId === previousQuestionId)
    setSelectedValue(prevAnswer?.value || null)

    // Remove answers for questions after the one we're going back to
    setAnswers(answers.filter((a) => a.questionId !== currentQuestionId))
  }

  // Calculate progress based on maximum possible questions (4)
  const maxQuestions = 4
  const progress = (answers.length / maxQuestions) * 100

  useEffect(() => {
    return () => {
      if (timeoutRef.current) window.clearTimeout(timeoutRef.current)
    }
  }, [])

  const transition = reduce
    ? { duration: 0 }
    : { duration: 0.26, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] }

  return (
    <div className="max-w-2xl mx-auto">
      {/* Progress bar */}
      <div className="h-2 overflow-hidden rounded-full bg-surface/10 mb-8">
        <motion.div
          className="h-2 rounded-full bg-chart-7"
          animate={{ width: `${progress}%` }}
          transition={reduce ? { duration: 0 } : { duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
        />
      </div>

      <Card>
        <CardContent className="pt-6">
          <AnimatePresence mode="wait" custom={direction}>
            <motion.div
              key={currentQuestionId}
              custom={direction}
              initial={reduce ? false : { opacity: 0, x: direction > 0 ? 28 : -28 }}
              animate={reduce ? undefined : { opacity: 1, x: 0 }}
              exit={reduce ? undefined : { opacity: 0, x: direction > 0 ? -28 : 28 }}
              transition={transition}
            >
              <h2 className="text-2xl font-bold mb-6">{currentQuestion.question}</h2>

              <div className="space-y-3">
                {currentQuestion.options.map((option) => {
                  const selected = selectedValue === option.value
                  const Icon = getOptionIcon(currentQuestionId, option.value)
                  return (
                    <button
                      key={option.value}
                      onClick={() => setSelectedValue(option.value)}
                      disabled={isThinking}
                      className={cn(
                        "w-full rounded-xl border p-4 text-left transition-all",
                        "focus:outline-none focus:ring-2 focus:ring-cyan-500/30",
                        selected
                          ? "border-cyan-500 bg-chart-7/10 ring-2 ring-cyan-500/40"
                          : "border-white/10 hover:border-white/20 hover:bg-surface/5",
                        isThinking && "opacity-70 cursor-not-allowed"
                      )}
                    >
                      <div className="flex items-start gap-3">
                        <div
                          className={cn(
                            "mt-0.5 flex h-10 w-10 items-center justify-center rounded-xl border",
                            selected
                              ? "border-accent-light/30 bg-surface/10 text-accent"
                              : "border-white/10 bg-surface/5 text-white/70"
                          )}
                        >
                          <Icon className="h-5 w-5" />
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium text-white">{option.label}</p>
                          {option.description && (
                            <p className="mt-1 text-sm text-white/70">{option.description}</p>
                          )}
                        </div>
                      </div>
                    </button>
                  )
                })}
              </div>
            </motion.div>
          </AnimatePresence>

          <div className="flex justify-between mt-8">
            <Button
              variant="ghost"
              onClick={handleBack}
              disabled={questionHistory.length <= 1 || isThinking}
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Natrag
            </Button>
            <Button onClick={handleNext} disabled={!selectedValue || isThinking}>
              {isThinking ? (
                <>
                  Razmišljam
                  <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                </>
              ) : (
                <>
                  Nastavi
                  <ArrowRight className="w-4 h-4 ml-2" />
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
