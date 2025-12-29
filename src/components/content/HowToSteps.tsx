import Image from "next/image"
import { cn } from "@/lib/utils"
import { JsonLd } from "@/components/seo/JsonLd"
import { generateHowToSchema } from "@/lib/schema"

interface Step {
  name: string
  text: string
  image?: string
}

interface HowToStepsProps {
  title: string
  description: string
  steps: Step[]
  totalTime?: string
  className?: string
}

export function HowToSteps({ title, description, steps, totalTime, className }: HowToStepsProps) {
  return (
    <>
      <JsonLd schemas={[generateHowToSchema(title, description, steps, totalTime)]} />
      <div className={cn("my-8", className)}>
        {totalTime && (
          <p className="mb-4 text-sm text-white/70">
            Potrebno vrijeme: {formatDuration(totalTime)}
          </p>
        )}
        <ol className="space-y-6">
          {steps.map((step, index) => (
            <li key={index} className="relative pl-10">
              <div className="absolute left-0 top-0 flex h-7 w-7 items-center justify-center rounded-full bg-chart-7 text-sm font-bold text-white">
                {index + 1}
              </div>
              <div>
                <h3 className="mb-1 font-semibold text-white">{step.name}</h3>
                <p className="text-white/90">{step.text}</p>
                {step.image && (
                  <div className="mt-3 overflow-hidden rounded-lg border border-white/20">
                    <Image
                      src={step.image}
                      alt={step.name}
                      width={600}
                      height={400}
                      className="w-full"
                    />
                  </div>
                )}
              </div>
            </li>
          ))}
        </ol>
      </div>
    </>
  )
}

function formatDuration(iso8601: string): string {
  const match = iso8601.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/)
  if (!match) return iso8601

  const [, hours, minutes, seconds] = match
  const parts = []
  if (hours) parts.push(`${hours} h`)
  if (minutes) parts.push(`${minutes} min`)
  if (seconds) parts.push(`${seconds} s`)
  return parts.join(" ") || iso8601
}
