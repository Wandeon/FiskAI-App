import { CheckCircle2, XCircle } from "lucide-react"
import { cn } from "@/lib/utils"
import { Reveal } from "@/components/motion/Reveal"

type ProsConsItem = {
  title: string
  description?: string
}

export function ProsCons({
  pros,
  cons,
  prosTitle = "Prednosti",
  consTitle = "Nedostaci",
  className,
}: {
  pros: ProsConsItem[]
  cons: ProsConsItem[]
  prosTitle?: string
  consTitle?: string
  className?: string
}) {
  return (
    <Reveal className={cn("not-prose my-6", className)}>
      <div className="grid gap-4 md:grid-cols-2">
        <section className="rounded-2xl border border-white/10 bg-surface/5 p-5 shadow-card">
          <header className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-chart-4/10 text-success">
              <CheckCircle2 className="h-5 w-5" aria-hidden />
            </span>
            <h4 className="text-sm font-semibold text-white">{prosTitle}</h4>
          </header>
          <ul className="mt-4 space-y-3">
            {pros.map((item) => (
              <li key={item.title} className="flex items-start gap-3">
                <CheckCircle2 className="mt-0.5 h-4 w-4 text-success" aria-hidden />
                <div>
                  <p className="m-0 text-sm font-semibold text-white">{item.title}</p>
                  {item.description && (
                    <p className="m-0 text-sm text-white/70">{item.description}</p>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-2xl border border-white/10 bg-surface/5 p-5 shadow-card">
          <header className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-chart-8/10 text-danger">
              <XCircle className="h-5 w-5" aria-hidden />
            </span>
            <h4 className="text-sm font-semibold text-white">{consTitle}</h4>
          </header>
          <ul className="mt-4 space-y-3">
            {cons.map((item) => (
              <li key={item.title} className="flex items-start gap-3">
                <XCircle className="mt-0.5 h-4 w-4 text-danger" aria-hidden />
                <div>
                  <p className="m-0 text-sm font-semibold text-white">{item.title}</p>
                  {item.description && (
                    <p className="m-0 text-sm text-white/70">{item.description}</p>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </Reveal>
  )
}
