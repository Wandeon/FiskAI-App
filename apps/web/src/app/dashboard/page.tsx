import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { SignOutButton } from "./sign-out-button"

export default async function DashboardPage() {
  const session = await auth()

  if (!session?.user) {
    redirect("/auth")
  }

  return (
    <div className="min-h-screen bg-slate-950 p-8">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white/10 backdrop-blur-xl rounded-2xl border border-white/20 p-8">
          <h1 className="text-3xl font-bold text-white mb-4">
            Dobrodosli, {session.user.name?.split(" ")[0] || "korisnice"}!
          </h1>
          <p className="text-white/70 mb-6">
            Ovo je vasa kontrolna ploca. FiskAI je u razvoju.
          </p>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 mb-8">
            <div className="bg-white/5 rounded-xl border border-white/10 p-6">
              <h3 className="text-sm font-medium text-white/50 mb-1">Email</h3>
              <p className="text-white">{session.user.email}</p>
            </div>
            <div className="bg-white/5 rounded-xl border border-white/10 p-6">
              <h3 className="text-sm font-medium text-white/50 mb-1">ID</h3>
              <p className="text-white font-mono text-sm">{session.user.id}</p>
            </div>
            <div className="bg-white/5 rounded-xl border border-white/10 p-6">
              <h3 className="text-sm font-medium text-white/50 mb-1">Status</h3>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-500/20 text-emerald-400">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                Aktivan
              </span>
            </div>
          </div>

          <div className="border-t border-white/10 pt-6">
            <h2 className="text-lg font-semibold text-white mb-4">Sljedeci koraci</h2>
            <ul className="space-y-2 text-white/70">
              <li className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-cyan-400" />
                Postavite podatke o tvrtki
              </li>
              <li className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-cyan-400" />
                Konfigurirajte poslovne prostore
              </li>
              <li className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-cyan-400" />
                Kreirajte prvi racun
              </li>
            </ul>
          </div>

          <div className="mt-8 pt-6 border-t border-white/10">
            <SignOutButton />
          </div>
        </div>
      </div>
    </div>
  )
}
