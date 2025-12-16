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
        <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-card">
          <header className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-green-50 text-green-700">
              <CheckCircle2 className="h-5 w-5" aria-hidden />
            </span>
            <h4 className="text-sm font-semibold text-[var(--foreground)]">{prosTitle}</h4>
          </header>
          <ul className="mt-4 space-y-3">
            {pros.map((item) => (
              <li key={item.title} className="flex items-start gap-3">
                <CheckCircle2 className="mt-0.5 h-4 w-4 text-green-600" aria-hidden />
                <div>
                  <p className="m-0 text-sm font-semibold text-[var(--foreground)]">{item.title}</p>
                  {item.description && (
                    <p className="m-0 text-sm text-[var(--muted)]">{item.description}</p>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-card">
          <header className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-50 text-rose-700">
              <XCircle className="h-5 w-5" aria-hidden />
            </span>
            <h4 className="text-sm font-semibold text-[var(--foreground)]">{consTitle}</h4>
          </header>
          <ul className="mt-4 space-y-3">
            {cons.map((item) => (
              <li key={item.title} className="flex items-start gap-3">
                <XCircle className="mt-0.5 h-4 w-4 text-rose-600" aria-hidden />
                <div>
                  <p className="m-0 text-sm font-semibold text-[var(--foreground)]">{item.title}</p>
                  {item.description && (
                    <p className="m-0 text-sm text-[var(--muted)]">{item.description}</p>
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
