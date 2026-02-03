import Link from "next/link"

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-950 to-black flex items-center justify-center p-4">
      <div className="text-center max-w-2xl">
        <h1 className="text-5xl font-bold text-white mb-4">
          Fisk<span className="text-cyan-400">AI</span>
        </h1>
        <p className="text-xl text-white/70 mb-8">
          Jednostavno e-fakturiranje za hrvatske poduzetnike
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link
            href="/auth"
            className="px-8 py-3 rounded-xl bg-cyan-600 text-white font-semibold hover:bg-cyan-700 transition-colors"
          >
            Prijavi se
          </Link>
          <Link
            href="/auth"
            className="px-8 py-3 rounded-xl bg-white/10 border border-white/20 text-white font-semibold hover:bg-white/20 transition-colors"
          >
            Registriraj se
          </Link>
        </div>

        <p className="mt-12 text-sm text-white/40">
          U razvoju - Sprint 0.2: Database & Auth
        </p>
      </div>
    </div>
  )
}
