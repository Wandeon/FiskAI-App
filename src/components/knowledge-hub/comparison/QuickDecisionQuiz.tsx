"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { ChevronRight, RotateCcw, Sparkles, CheckCircle2 } from "lucide-react"
import { cn } from "@/lib/utils"

interface QuizQuestion {
  id: string
  question: string
  options: {
    label: string
    value: string
    points: Record<string, number>
  }[]
}

interface QuizResult {
  key: string
  title: string
  description: string
  color: string
  link?: string
}

interface QuickDecisionQuizProps {
  title?: string
  questions: QuizQuestion[]
  results: QuizResult[]
}

export function QuickDecisionQuiz({
  title = "Brza odluka",
  questions,
  results,
}: QuickDecisionQuizProps) {
  const [currentQuestion, setCurrentQuestion] = useState(0)
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [scores, setScores] = useState<Record<string, number>>({})
  const [showResult, setShowResult] = useState(false)

  const handleAnswer = (questionId: string, value: string, points: Record<string, number>) => {
    const newAnswers = { ...answers, [questionId]: value }
    setAnswers(newAnswers)

    // Update scores
    const newScores = { ...scores }
    Object.entries(points).forEach(([key, pts]) => {
      newScores[key] = (newScores[key] || 0) + pts
    })
    setScores(newScores)

    // Move to next question or show result
    if (currentQuestion < questions.length - 1) {
      setTimeout(() => setCurrentQuestion((q) => q + 1), 300)
    } else {
      setTimeout(() => setShowResult(true), 300)
    }
  }

  const getWinner = (): QuizResult => {
    let maxScore = -1
    let winner = results[0]

    results.forEach((result) => {
      const score = scores[result.key] || 0
      if (score > maxScore) {
        maxScore = score
        winner = result
      }
    })

    return winner
  }

  const reset = () => {
    setCurrentQuestion(0)
    setAnswers({})
    setScores({})
    setShowResult(false)
  }

  const progress = ((currentQuestion + (showResult ? 1 : 0)) / questions.length) * 100

  return (
    <div className="my-6 rounded-xl border border-accent-light/30 bg-gradient-to-br from-accent/10 to-interactive/10 p-6 shadow-sm">
      <div className="mb-4 flex items-center gap-2">
        <Sparkles className="h-5 w-5 text-accent" />
        <h3 className="text-lg font-semibold text-white">{title}</h3>
      </div>

      {/* Progress bar */}
      <div className="mb-6 h-2 overflow-hidden rounded-full bg-surface/10">
        <motion.div
          className="h-full bg-chart-7"
          initial={{ width: 0 }}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.3 }}
        />
      </div>

      <AnimatePresence mode="wait">
        {!showResult ? (
          <motion.div
            key={`question-${currentQuestion}`}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
          >
            <p className="mb-4 text-sm text-accent">
              Pitanje {currentQuestion + 1} od {questions.length}
            </p>
            <p className="mb-4 text-base font-medium text-white">
              {questions[currentQuestion].question}
            </p>
            <div className="grid gap-2">
              {questions[currentQuestion].options.map((option) => (
                <button
                  key={option.value}
                  onClick={() =>
                    handleAnswer(questions[currentQuestion].id, option.value, option.points)
                  }
                  className={cn(
                    "flex items-center justify-between rounded-lg border px-4 py-3 text-left text-sm transition-all text-white",
                    answers[questions[currentQuestion].id] === option.value
                      ? "border-accent-light bg-chart-7/20"
                      : "border-white/20 bg-surface/5 hover:border-accent-light/50 hover:bg-chart-7/10"
                  )}
                >
                  <span>{option.label}</span>
                  <ChevronRight className="h-4 w-4 text-white/50" />
                </button>
              ))}
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="result"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center"
          >
            {(() => {
              const winner = getWinner()
              return (
                <>
                  <div
                    className={cn(
                      "mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full",
                      winner.color
                    )}
                  >
                    <CheckCircle2 className="h-8 w-8 text-white" />
                  </div>
                  <h4 className="mb-2 text-xl font-bold text-white">Preporučamo: {winner.title}</h4>
                  <p className="mb-4 text-sm text-white/70">{winner.description}</p>
                  {winner.link && (
                    <a
                      href={winner.link}
                      className="mb-4 inline-block rounded-lg bg-chart-7 px-4 py-2 text-sm font-medium text-white hover:bg-interactive"
                    >
                      Saznaj više o {winner.title}
                    </a>
                  )}
                </>
              )
            })()}
            <button
              onClick={reset}
              className="mt-4 inline-flex items-center gap-2 text-sm text-accent hover:text-cyan-300"
            >
              <RotateCcw className="h-4 w-4" />
              Ponovi kviz
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
