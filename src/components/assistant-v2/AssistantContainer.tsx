"use client"

import React, { useState, useCallback, FormEvent } from "react"
import {
  useAssistantController,
  type Surface,
  type AssistantResponse,
} from "@/lib/assistant/client"
import { cn } from "@/lib/utils"

interface AssistantContainerProps {
  surface: Surface
  companyId?: string
  className?: string
}

export function AssistantContainer({ surface, companyId, className }: AssistantContainerProps) {
  const { state, submit } = useAssistantController({ surface })
  const [inputValue, setInputValue] = useState("")

  const isApp = surface === "APP"
  const isLoading = state.status === "LOADING" || state.status === "STREAMING"
  const isComplete = state.status === "COMPLETE" || state.status === "PARTIAL_COMPLETE"
  const hasError = state.status === "ERROR"

  const handleSubmit = useCallback(
    async (e: FormEvent) => {
      e.preventDefault()
      const trimmed = inputValue.trim()
      if (!trimmed || isLoading) return
      await submit(trimmed)
    },
    [inputValue, isLoading, submit]
  )

  return (
    <section
      role="region"
      aria-label="Regulatory assistant"
      aria-busy={isLoading}
      className={cn("flex flex-col gap-4", className)}
    >
      {/* Input Section */}
      <form onSubmit={handleSubmit} id="assistant-input">
        <div className="flex gap-2">
          <textarea
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder={
              isApp
                ? "Ask about regulations or your business..."
                : "Ask about Croatian tax, VAT, contributions, fiscalization..."
            }
            className="flex-1 p-3 border rounded-lg resize-none"
            rows={2}
            disabled={isLoading}
            aria-label="Question input"
          />
          <button
            type="submit"
            disabled={isLoading || !inputValue.trim()}
            className={cn(
              "px-4 py-2 rounded-lg font-medium transition-colors",
              isLoading
                ? "bg-gray-200 text-gray-500 cursor-not-allowed"
                : "bg-blue-600 text-white hover:bg-blue-700"
            )}
          >
            {isLoading ? "Searching..." : "Ask"}
          </button>
        </div>
      </form>

      {/* Loading State */}
      {isLoading && (
        <div className="flex items-center gap-2 text-blue-600" role="status" aria-live="polite">
          <span className="animate-spin">⟳</span>
          <span>Searching official sources...</span>
        </div>
      )}

      {/* Error State */}
      {hasError && state.error && (
        <div
          className="p-4 border border-red-200 bg-red-50 rounded-lg text-red-700"
          role="alert"
          aria-live="assertive"
        >
          <strong>Error:</strong> {state.error.message}
        </div>
      )}

      {/* Main Content Grid */}
      {isComplete && state.activeAnswer && (
        <div className={cn("grid gap-6", isApp ? "lg:grid-cols-3" : "lg:grid-cols-2")}>
          {/* Answer Column */}
          <div data-testid="answer-column" className="lg:col-span-1">
            <AnswerCard response={state.activeAnswer} />
          </div>

          {/* Evidence Column */}
          <div data-testid="evidence-column" className="lg:col-span-1">
            <EvidenceCard response={state.activeAnswer} />
          </div>

          {/* Client Data Column (APP only) */}
          {isApp && (
            <div data-testid="client-data-column" className="lg:col-span-1">
              <ClientDataCard response={state.activeAnswer} />
            </div>
          )}
        </div>
      )}

      {/* Empty State */}
      {state.status === "IDLE" && (
        <div className={cn("grid gap-6", isApp ? "lg:grid-cols-3" : "lg:grid-cols-2")}>
          <div className="p-4 border rounded-lg min-h-[200px]">
            <p className="text-muted-foreground">Verified answer will appear here</p>
          </div>
          <div className="p-4 border rounded-lg min-h-[200px]">
            <h3 className="font-medium mb-2">Sources</h3>
            <p className="text-muted-foreground text-sm">
              Official regulations, laws, and guidance
            </p>
          </div>
          {isApp && (
            <div className="p-4 border rounded-lg min-h-[200px]">
              <h3 className="font-medium mb-2">Your data</h3>
              <p className="text-muted-foreground text-sm">
                Connected sources will be used for personalized answers
              </p>
            </div>
          )}
        </div>
      )}
    </section>
  )
}

// Answer Card Component
function AnswerCard({ response }: { response: AssistantResponse }) {
  if (response.kind === "REFUSAL") {
    return (
      <div
        className="p-4 border border-amber-200 bg-amber-50 rounded-lg min-h-[200px]"
        role="alert"
      >
        <h3 className="font-medium text-amber-800 mb-2">Cannot provide answer</h3>
        <p className="text-amber-700 mb-3">{response.refusal?.message}</p>
        {response.refusalReason && (
          <span className="inline-block px-2 py-1 text-xs font-medium bg-amber-100 text-amber-800 rounded">
            {formatRefusalReason(response.refusalReason)}
          </span>
        )}
        {response.refusal?.relatedTopics && response.refusal.relatedTopics.length > 0 && (
          <div className="mt-3 pt-3 border-t border-amber-200">
            <p className="text-sm text-amber-700 mb-1">Related topics:</p>
            <div className="flex flex-wrap gap-1">
              {response.refusal.relatedTopics.map((topic, i) => (
                <span key={i} className="px-2 py-0.5 text-xs bg-amber-100 rounded">
                  {topic}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="p-4 border rounded-lg min-h-[200px]">
      <h3 className="font-medium text-lg mb-2">{response.headline}</h3>
      <p className="text-gray-700 mb-4">{response.directAnswer}</p>
      {response.confidence && (
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "px-2 py-0.5 text-xs font-medium rounded",
              response.confidence.level === "HIGH"
                ? "bg-green-100 text-green-800"
                : response.confidence.level === "MEDIUM"
                  ? "bg-yellow-100 text-yellow-800"
                  : "bg-red-100 text-red-800"
            )}
          >
            {response.confidence.level} confidence
          </span>
        </div>
      )}
    </div>
  )
}

// Evidence Card Component
function EvidenceCard({ response }: { response: AssistantResponse }) {
  if (response.kind === "REFUSAL" || !response.citations) {
    return (
      <div className="p-4 border rounded-lg min-h-[200px]">
        <h3 className="font-medium mb-2">Sources</h3>
        <p className="text-muted-foreground text-sm">No citations available</p>
      </div>
    )
  }

  const { primary, supporting = [] } = response.citations

  return (
    <div className="p-4 border rounded-lg min-h-[200px]">
      <h3 className="font-medium mb-3">Sources</h3>

      {/* Primary Citation */}
      <div className="p-3 bg-blue-50 border border-blue-100 rounded-lg mb-3">
        <div className="flex items-start gap-2">
          <span className="text-blue-600 font-medium text-sm">Primary:</span>
          <div className="flex-1">
            {primary.url && (
              <a
                href={primary.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline text-sm block mb-1"
              >
                {primary.reference || primary.title || primary.url}
              </a>
            )}
            {primary.quote && (
              <blockquote className="text-sm text-gray-600 italic border-l-2 border-blue-200 pl-2">
                &ldquo;{primary.quote}&rdquo;
              </blockquote>
            )}
            {primary.fetchedAt && (
              <p className="text-xs text-gray-500 mt-1">
                Fetched: {new Date(primary.fetchedAt).toLocaleDateString("hr-HR")}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Supporting Citations */}
      {supporting.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-medium text-gray-600">Supporting sources:</p>
          {supporting.map((citation, i) => (
            <div key={i} className="p-2 bg-gray-50 rounded text-sm">
              {citation.url && (
                <a
                  href={citation.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline"
                >
                  {citation.reference || citation.title || citation.url}
                </a>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// Client Data Card Component (APP surface only)
function ClientDataCard({ response }: { response: AssistantResponse }) {
  if (!response.clientContext) {
    return (
      <div className="p-4 border rounded-lg min-h-[200px]">
        <h3 className="font-medium mb-2">Your data</h3>
        <p className="text-muted-foreground text-sm">
          Connect your business data for personalized answers
        </p>
      </div>
    )
  }

  const { used = [], completeness, missing = [] } = response.clientContext

  return (
    <div className="p-4 border rounded-lg min-h-[200px]">
      <h3 className="font-medium mb-3">Your data</h3>

      {/* Completeness Status */}
      <div
        className={cn(
          "mb-3 p-2 rounded text-sm",
          completeness.status === "COMPLETE"
            ? "bg-green-50 text-green-700"
            : completeness.status === "PARTIAL"
              ? "bg-yellow-50 text-yellow-700"
              : "bg-gray-50 text-gray-700"
        )}
      >
        {completeness.status === "COMPLETE" && "✓ Answer personalized with your data"}
        {completeness.status === "PARTIAL" && "⚠ Some data missing for full personalization"}
        {completeness.status === "NONE" && "No business data used"}
      </div>

      {/* Used Data Points */}
      {used.length > 0 && (
        <div className="space-y-1">
          <p className="text-sm font-medium text-gray-600">Data used:</p>
          {used.map((point, i) => (
            <div key={i} className="flex items-center gap-2 text-sm">
              <span className="text-green-600">✓</span>
              <span>
                {point.label}: {point.value}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Missing Data */}
      {missing.length > 0 && (
        <div className="mt-3 pt-3 border-t">
          <p className="text-sm font-medium text-amber-600">Missing data:</p>
          {missing.map((item, i) => (
            <div key={i} className="flex items-center gap-2 text-sm text-amber-600">
              <span>○</span>
              <span>{item.label}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function formatRefusalReason(reason: string): string {
  const map: Record<string, string> = {
    NO_CITABLE_RULES: "No official sources found",
    UNRESOLVED_CONFLICT: "Conflicting regulations",
    OUT_OF_SCOPE: "Outside assistant scope",
    MISSING_CLIENT_DATA: "Business data required",
    CALCULATION_REQUIRED: "Calculation needed",
  }
  return map[reason] || reason
}
