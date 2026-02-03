import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { prisma } from "@fiskai/db"
import { SignOutButton } from "./sign-out-button"

const LEGAL_FORM_LABELS: Record<string, string> = {
  OBRT_PAUSAL: "Paušalni obrt",
  OBRT_REAL: "Obrt",
  DOO: "d.o.o.",
  JDOO: "j.d.o.o.",
}

export default async function DashboardPage() {
  const session = await auth()

  if (!session?.user?.id) {
    redirect("/auth")
  }

  // Check if user has a company with completed onboarding
  const companyMember = await prisma.companyMember.findFirst({
    where: { userId: session.user.id },
    include: { company: true },
  })

  // Redirect to onboarding if no company or onboarding not complete
  if (!companyMember?.company || !companyMember.company.onboardingComplete) {
    redirect("/onboarding")
  }

  const company = companyMember.company

  return (
    <div className="min-h-screen bg-slate-950 p-8">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white/10 backdrop-blur-xl rounded-2xl border border-white/20 p-8">
          <h1 className="text-3xl font-bold text-white mb-4">
            Dobrodošli, {session.user.name?.split(" ")[0] || "korisniče"}!
          </h1>
          <p className="text-white/70 mb-6">
            Kontrolna ploča za {company.name}
          </p>

          {/* Company Info Card */}
          <div className="bg-gradient-to-br from-cyan-500/10 to-blue-500/10 rounded-xl border border-cyan-500/20 p-6 mb-8">
            <h2 className="text-lg font-semibold text-white mb-4">Podaci o tvrtki</h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <div>
                <h3 className="text-sm font-medium text-white/50 mb-1">Naziv</h3>
                <p className="text-white">{company.name}</p>
              </div>
              <div>
                <h3 className="text-sm font-medium text-white/50 mb-1">OIB</h3>
                <p className="text-white font-mono">{company.oib}</p>
              </div>
              <div>
                <h3 className="text-sm font-medium text-white/50 mb-1">Pravni oblik</h3>
                <p className="text-white">{LEGAL_FORM_LABELS[company.legalForm] || company.legalForm}</p>
              </div>
              {company.address && (
                <div className="sm:col-span-2 lg:col-span-3">
                  <h3 className="text-sm font-medium text-white/50 mb-1">Adresa</h3>
                  <p className="text-white">
                    {company.address}
                    {company.zipCode && company.city && `, ${company.zipCode} ${company.city}`}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* User Info */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 mb-8">
            <div className="bg-white/5 rounded-xl border border-white/10 p-6">
              <h3 className="text-sm font-medium text-white/50 mb-1">Email</h3>
              <p className="text-white">{session.user.email}</p>
            </div>
            <div className="bg-white/5 rounded-xl border border-white/10 p-6">
              <h3 className="text-sm font-medium text-white/50 mb-1">Uloga</h3>
              <p className="text-white">{companyMember.role === "OWNER" ? "Vlasnik" : companyMember.role === "ADMIN" ? "Administrator" : "Član"}</p>
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
            <h2 className="text-lg font-semibold text-white mb-4">Sljedeći koraci</h2>
            <ul className="space-y-2 text-white/70">
              <li className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-cyan-400" />
                Konfigurirajte poslovne prostore
              </li>
              <li className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-cyan-400" />
                Dodajte naplatne uređaje
              </li>
              <li className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-cyan-400" />
                Kreirajte prvi račun
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
