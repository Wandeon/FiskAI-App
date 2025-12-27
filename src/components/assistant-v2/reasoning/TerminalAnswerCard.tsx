// src/components/assistant-v2/reasoning/TerminalAnswerCard.tsx
"use client"

import { cn } from "@/lib/utils"
import { AlertTriangle, CheckCircle, XCircle, AlertCircle } from "lucide-react"
import type { TerminalOutcome, ErrorPayload } from "@/lib/assistant/reasoning"

// UI-specific payload types (may differ from lib types)
interface AnswerPayloadUI {
  answer?: string
  answerHr: string
  asOfDate?: string
  structured?: {
    obligations?: string[]
    deadlines?: string[]
    thresholds?: string[]
  }
  citations?: Array<{ title: string; quote: string; url: string }>
}

interface QualifiedAnswerPayloadUI {
  answerHr: string
  conflictWarnings?: Array<{
    description: string
    sourceA: { name: string; says: string }
    sourceB: { name: string; says: string }
    practicalResolution?: string
  }>
  caveats?: string[]
  citations?: Array<{ title: string; quote: string; url: string }>
}

interface RefusalPayloadUI {
  messageHr?: string
  template?: {
    messageHr: string
    nextSteps?: Array<{
      type: string
      prompt?: string
      promptHr?: string
    }>
  }
  nextSteps?: Array<{
    type: string
    prompt?: string
    promptHr?: string
  }>
}

interface TerminalAnswerCardProps {
  outcome: TerminalOutcome
  payload: unknown
  className?: string
}

export function TerminalAnswerCard({ outcome, payload, className }: TerminalAnswerCardProps) {
  switch (outcome) {
    case "ANSWER":
      return <AnswerCard payload={payload as AnswerPayloadUI} className={className} />
    case "CONDITIONAL_ANSWER":
      return (
        <QualifiedAnswerCard payload={payload as QualifiedAnswerPayloadUI} className={className} />
      )
    case "REFUSAL":
      return <RefusalCard payload={payload as RefusalPayloadUI} className={className} />
    case "ERROR":
      return <ErrorCard payload={payload as ErrorPayload} className={className} />
  }
}

// === ANSWER ===
function AnswerCard({ payload, className }: { payload: AnswerPayloadUI; className?: string }) {
  return (
    <div className={cn("bg-white rounded-xl border border-green-200 overflow-hidden", className)}>
      {/* Header */}
      <div className="px-4 py-3 bg-green-50 border-b border-green-200 flex items-center gap-2">
        <CheckCircle className="w-5 h-5 text-green-600" />
        <span className="font-medium text-green-800">Odgovor</span>
        {payload.asOfDate && (
          <span className="ml-auto text-xs text-gray-500">Na dan: {payload.asOfDate}</span>
        )}
      </div>

      {/* Answer content */}
      <div className="p-4">
        <p className="text-gray-900 leading-relaxed">{payload.answerHr}</p>

        {/* Structured data */}
        {payload.structured && <StructuredData structured={payload.structured} />}

        {/* Citations */}
        {payload.citations && payload.citations.length > 0 && (
          <Citations citations={payload.citations} />
        )}
      </div>
    </div>
  )
}

// === QUALIFIED ANSWER ===
function QualifiedAnswerCard({
  payload,
  className,
}: {
  payload: QualifiedAnswerPayloadUI
  className?: string
}) {
  const conflictWarnings = payload.conflictWarnings ?? []
  const caveats = payload.caveats ?? []
  const citations = payload.citations ?? []

  return (
    <div className={cn("bg-white rounded-xl border border-yellow-200 overflow-hidden", className)}>
      {/* Header */}
      <div className="px-4 py-3 bg-yellow-50 border-b border-yellow-200 flex items-center gap-2">
        <AlertTriangle className="w-5 h-5 text-yellow-600" />
        <span className="font-medium text-yellow-800">Odgovor s upozorenjem</span>
      </div>

      {/* Conflict warnings */}
      {conflictWarnings.map((warning, i) => (
        <div key={i} className="mx-4 mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
          <p className="text-sm font-medium text-yellow-800">{warning.description}</p>
          <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
            <div className="p-2 bg-white rounded">
              <span className="font-medium">{warning.sourceA.name}:</span>
              <p className="text-gray-600">{warning.sourceA.says}</p>
            </div>
            <div className="p-2 bg-white rounded">
              <span className="font-medium">{warning.sourceB.name}:</span>
              <p className="text-gray-600">{warning.sourceB.says}</p>
            </div>
          </div>
          {warning.practicalResolution && (
            <p className="mt-2 text-sm text-gray-700">
              <strong>U praksi:</strong> {warning.practicalResolution}
            </p>
          )}
        </div>
      ))}

      {/* Answer content */}
      <div className="p-4">
        <p className="text-gray-900 leading-relaxed">{payload.answerHr}</p>

        {/* Caveats */}
        {caveats.length > 0 && (
          <div className="mt-3 p-3 bg-gray-50 rounded-lg">
            <h4 className="text-xs font-medium text-gray-500 uppercase mb-2">Napomene</h4>
            <ul className="space-y-1 text-sm text-gray-600">
              {caveats.map((caveat, i) => (
                <li key={i}>• {caveat}</li>
              ))}
            </ul>
          </div>
        )}

        {citations.length > 0 && <Citations citations={citations} />}
      </div>
    </div>
  )
}

// === REFUSAL ===
function RefusalCard({ payload, className }: { payload: RefusalPayloadUI; className?: string }) {
  // Handle both flat and nested template structures
  const messageHr = payload.messageHr ?? payload.template?.messageHr ?? "Nije moguće odgovoriti"
  const nextSteps = payload.nextSteps ?? payload.template?.nextSteps ?? []

  return (
    <div className={cn("bg-white rounded-xl border border-gray-200 overflow-hidden", className)}>
      {/* Header */}
      <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex items-center gap-2">
        <XCircle className="w-5 h-5 text-gray-500" />
        <span className="font-medium text-gray-700">Nije moguće odgovoriti</span>
      </div>

      {/* Content */}
      <div className="p-4">
        <p className="text-gray-700">{messageHr}</p>

        {/* Next steps */}
        {nextSteps.length > 0 && (
          <div className="mt-4">
            <h4 className="text-xs font-medium text-gray-500 uppercase mb-2">Sljedeći koraci</h4>
            <div className="flex flex-wrap gap-2">
              {nextSteps.map((step, i) => (
                <button
                  key={i}
                  className="px-3 py-1.5 bg-blue-50 text-blue-700 text-sm rounded-full hover:bg-blue-100 transition-colors"
                >
                  {step.promptHr || step.prompt || step.type}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// === ERROR ===
function ErrorCard({ payload, className }: { payload: ErrorPayload; className?: string }) {
  return (
    <div className={cn("bg-white rounded-xl border border-red-200 overflow-hidden", className)}>
      {/* Header */}
      <div className="px-4 py-3 bg-red-50 border-b border-red-200 flex items-center gap-2">
        <AlertCircle className="w-5 h-5 text-red-600" />
        <span className="font-medium text-red-800">Greška</span>
        <span className="ml-auto text-xs text-gray-500 font-mono">{payload.correlationId}</span>
      </div>

      {/* Content */}
      <div className="p-4">
        <p className="text-gray-700">{payload.message}</p>

        {payload.retryable && (
          <button className="mt-4 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors">
            Pokušaj ponovo
          </button>
        )}
      </div>
    </div>
  )
}

// === SHARED COMPONENTS ===

function StructuredData({ structured }: { structured: AnswerPayloadUI["structured"] }) {
  if (!structured) return null

  return (
    <div className="mt-4 grid gap-3">
      {structured.obligations && structured.obligations.length > 0 && (
        <div className="p-3 bg-blue-50 rounded-lg">
          <h4 className="text-xs font-medium text-blue-700 uppercase mb-1">Obveze</h4>
          <ul className="space-y-1 text-sm text-gray-700">
            {structured.obligations.map((o, i) => (
              <li key={i}>• {o}</li>
            ))}
          </ul>
        </div>
      )}

      {structured.deadlines && structured.deadlines.length > 0 && (
        <div className="p-3 bg-orange-50 rounded-lg">
          <h4 className="text-xs font-medium text-orange-700 uppercase mb-1">Rokovi</h4>
          <ul className="space-y-1 text-sm text-gray-700">
            {structured.deadlines.map((d, i) => (
              <li key={i}>• {d}</li>
            ))}
          </ul>
        </div>
      )}

      {structured.thresholds && structured.thresholds.length > 0 && (
        <div className="p-3 bg-purple-50 rounded-lg">
          <h4 className="text-xs font-medium text-purple-700 uppercase mb-1">Pragovi</h4>
          <ul className="space-y-1 text-sm text-gray-700">
            {structured.thresholds.map((t, i) => (
              <li key={i}>• {t}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

function Citations({
  citations,
}: {
  citations: Array<{ title: string; quote: string; url: string }>
}) {
  return (
    <div className="mt-4 pt-4 border-t border-gray-100">
      <h4 className="text-xs font-medium text-gray-500 uppercase mb-2">Izvori</h4>
      <div className="space-y-2">
        {citations.map((citation, i) => (
          <div key={i} className="p-3 bg-gray-50 rounded-lg">
            <a
              href={citation.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-medium text-blue-600 hover:underline"
            >
              {citation.title}
            </a>
            <p className="text-sm text-gray-600 mt-1 italic">&ldquo;{citation.quote}&rdquo;</p>
          </div>
        ))}
      </div>
    </div>
  )
}
