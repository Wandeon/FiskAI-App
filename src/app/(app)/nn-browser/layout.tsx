import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "NN Browser | FiskAI",
  description: "Browse Narodne Novine gazette items",
}

export default function NNBrowserLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-surface">
      <header className="bg-surface border-b border-border px-4 py-3">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <h1 className="text-xl font-semibold text-foreground">Narodne Novine Browser</h1>
          <span className="text-sm text-muted-foreground">Internal Tool</span>
        </div>
      </header>
      <main className="max-w-7xl mx-auto px-4 py-6">{children}</main>
    </div>
  )
}
