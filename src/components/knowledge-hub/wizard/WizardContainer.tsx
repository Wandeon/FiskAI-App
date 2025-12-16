// src/components/knowledge-hub/wizard/WizardContainer.tsx
"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { WIZARD_QUESTIONS, getWizardResult } from "@/lib/knowledge-hub/wizard-logic"
import { WizardAnswer } from "@/lib/knowledge-hub/types"
import { ArrowLeft, ArrowRight } from "lucide-react"

export function WizardContainer() {
  const router = useRouter()
  const [currentQuestionId, setCurrentQuestionId] = useState("employment")
  const [answers, setAnswers] = useState<WizardAnswer[]>([])
  const [selectedValue, setSelectedValue] = useState<string | null>(null)
  const [questionHistory, setQuestionHistory] = useState<string[]>(["employment"])

  const currentQuestion = WIZARD_QUESTIONS[currentQuestionId]

  const handleNext = () => {
    if (!selectedValue) return

    const newAnswers = [
      ...answers.filter((a) => a.questionId !== currentQuestionId),
      { questionId: currentQuestionId, value: selectedValue },
    ]
    setAnswers(newAnswers)

    const nextId = currentQuestion.nextQuestion(selectedValue, newAnswers)

    if (nextId) {
      setCurrentQuestionId(nextId)
      setQuestionHistory([...questionHistory, nextId])
      setSelectedValue(null)
    } else {
      // Wizard complete - navigate to result page
      const result = getWizardResult(newAnswers)
      const url = result.params ? `${result.path}?${result.params.toString()}` : result.path
      router.push(url)
    }
  }

  const handleBack = () => {
    if (questionHistory.length <= 1) return

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

  return (
    <div className="max-w-2xl mx-auto">
      {/* Progress bar */}
      <div className="h-2 bg-gray-200 rounded-full mb-8">
        <div
          className="h-2 bg-blue-600 rounded-full transition-all duration-300"
          style={{ width: `${progress}%` }}
        />
      </div>

      <Card>
        <CardContent className="pt-6">
          <h2 className="text-2xl font-bold mb-6">{currentQuestion.question}</h2>

          <div className="space-y-3">
            {currentQuestion.options.map((option) => (
              <button
                key={option.value}
                onClick={() => setSelectedValue(option.value)}
                className={`w-full p-4 rounded-lg border text-left transition-all ${
                  selectedValue === option.value
                    ? "border-blue-500 bg-blue-50 ring-2 ring-blue-500"
                    : "border-gray-200 hover:border-gray-300"
                }`}
              >
                <p className="font-medium">{option.label}</p>
                {option.description && (
                  <p className="text-sm text-gray-500 mt-1">{option.description}</p>
                )}
              </button>
            ))}
          </div>

          <div className="flex justify-between mt-8">
            <Button variant="ghost" onClick={handleBack} disabled={questionHistory.length <= 1}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Natrag
            </Button>
            <Button onClick={handleNext} disabled={!selectedValue}>
              Nastavi
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
