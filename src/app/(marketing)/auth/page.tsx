import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { AuthFlow } from "@/components/auth"

export const metadata = {
  title: "Prijava | FiskAI",
  description: "Prijavite se ili kreirajte FiskAI račun",
}

export default async function AuthPage() {
  // Redirect if already authenticated
  const session = await auth()
  if (session?.user) {
    redirect("/dashboard")
  }

  return <AuthFlow />
}
