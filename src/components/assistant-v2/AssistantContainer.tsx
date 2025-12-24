"use client"

import React from "react"
import { useAssistantController, type Surface } from "@/lib/assistant"
import { cn } from "@/lib/utils"

interface AssistantContainerProps {
  surface: Surface
  className?: string
}

export function AssistantContainer({ surface, className }: AssistantContainerProps) {
  const { state, submit } = useAssistantController({ surface })

  const isApp = surface === "APP"

  return (
    <section
      role="region"
      aria-label="Regulatory assistant"
      className={cn("flex flex-col gap-4", className)}
    >
      {/* Input Section */}
      <div id="assistant-input">
        <textarea
          placeholder={
            isApp
              ? "Ask about regulations or your business..."
              : "Ask about Croatian tax, VAT, contributions, fiscalization..."
          }
          className="w-full p-3 border rounded-lg resize-none"
          rows={2}
        />
      </div>

      {/* Main Content Grid */}
      <div className={cn("grid gap-6", isApp ? "lg:grid-cols-3" : "lg:grid-cols-2")}>
        {/* Answer Column */}
        <div data-testid="answer-column" className="lg:col-span-1">
          <div className="p-4 border rounded-lg min-h-[200px]">
            <p className="text-muted-foreground">Verified answer will appear here</p>
          </div>
        </div>

        {/* Evidence Column */}
        <div data-testid="evidence-column" className="lg:col-span-1">
          <div className="p-4 border rounded-lg min-h-[200px]">
            <h3 className="font-medium mb-2">Sources</h3>
            <p className="text-muted-foreground text-sm">
              Official regulations, laws, and guidance
            </p>
          </div>
        </div>

        {/* Client Data Column (APP only) */}
        {isApp && (
          <div data-testid="client-data-column" className="lg:col-span-1">
            <div className="p-4 border rounded-lg min-h-[200px]">
              <h3 className="font-medium mb-2">Your data</h3>
              <p className="text-muted-foreground text-sm">
                Connected sources will be used for personalized answers
              </p>
            </div>
          </div>
        )}
      </div>
    </section>
  )
}
