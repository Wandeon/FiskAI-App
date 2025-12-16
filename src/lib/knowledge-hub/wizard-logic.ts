// src/lib/knowledge-hub/wizard-logic.ts
import { WizardAnswer } from "./types"

export interface WizardQuestion {
  id: string
  question: string
  options: { value: string; label: string; description?: string }[]
  nextQuestion: (answer: string, answers: WizardAnswer[]) => string | null
}

export interface WizardResult {
  type: "guide" | "comparison"
  path: string
  params?: URLSearchParams
}

export const WIZARD_QUESTIONS: Record<string, WizardQuestion> = {
  employment: {
    id: "employment",
    question: "Radni status?",
    options: [
      { value: "employed", label: "Zaposlen/a", description: "Radim kod drugog poslodavca" },
      {
        value: "unemployed",
        label: "Nezaposlen/a",
        description: "Tražim posao ili pokrećem vlastiti",
      },
      { value: "retired", label: "Umirovljenik", description: "Primam mirovinu" },
      { value: "student", label: "Student", description: "Studiram" },
    ],
    nextQuestion: (answer) => {
      // Retirees and students exit early to guide pages
      if (answer === "retired" || answer === "student") {
        return null
      }
      return "intent"
    },
  },
  intent: {
    id: "intent",
    question: "Što želite?",
    options: [
      {
        value: "side",
        label: "Dodatni prihod uz posao",
        description: "Zarađivati uz stalno zaposlenje",
      },
      {
        value: "main",
        label: "Primarni izvor prihoda",
        description: "Ovo će biti moj glavni posao",
      },
      { value: "partners", label: "Osnovati firmu s partnerima", description: "Višečlano društvo" },
    ],
    nextQuestion: (answer) => {
      // Side income and partners exit early
      if (answer === "side" || answer === "partners") {
        return null
      }
      return "revenue"
    },
  },
  revenue: {
    id: "revenue",
    question: "Očekivani godišnji prihod?",
    options: [
      { value: "low", label: "Do 40.000€", description: "Manji opseg poslovanja" },
      { value: "medium", label: "40.000 - 60.000€", description: "Srednji opseg" },
      { value: "high", label: "Preko 60.000€", description: "Prelazi limit za paušal" },
    ],
    nextQuestion: (answer) => {
      // High revenue exits early
      if (answer === "high") {
        return null
      }
      // Low and medium continue to activity
      return "activity"
    },
  },
  activity: {
    id: "activity",
    question: "Vrsta djelatnosti?",
    options: [
      { value: "it", label: "IT / Programiranje", description: "Softver, web, konzalting" },
      {
        value: "kreativa",
        label: "Kreativne usluge",
        description: "Dizajn, marketing, savjetovanje",
      },
      { value: "trgovina", label: "Trgovina", description: "Prodaja proizvoda" },
      { value: "ostalo", label: "Ostalo", description: "Druga vrsta djelatnosti" },
    ],
    nextQuestion: () => null,
  },
}

export function getWizardResult(answers: WizardAnswer[]): WizardResult {
  const getAnswer = (id: string) => answers.find((a) => a.questionId === id)?.value

  const employment = getAnswer("employment")
  const intent = getAnswer("intent")
  const revenue = getAnswer("revenue")
  const activity = getAnswer("activity")

  // Q1: Early exits for retirees and students
  if (employment === "retired") {
    const params = new URLSearchParams()
    params.set("varijanta", "umirovljenik")
    return {
      type: "guide",
      path: "/vodic/pausalni-obrt",
      params,
    }
  }

  if (employment === "student") {
    const params = new URLSearchParams()
    params.set("varijanta", "student")
    return {
      type: "guide",
      path: "/vodic/pausalni-obrt",
      params,
    }
  }

  // Q2: Intent-based routing
  if (intent === "side") {
    return {
      type: "comparison",
      path: "/usporedba/dodatni-prihod",
    }
  }

  if (intent === "partners") {
    const params = new URLSearchParams()
    params.set("tip", "viseclano")
    return {
      type: "comparison",
      path: "/usporedba/firma",
      params,
    }
  }

  // Q3: Revenue-based routing for main income
  if (revenue === "high") {
    return {
      type: "comparison",
      path: "/usporedba/preko-praga",
    }
  }

  // Q3 + Q4: Solo path with revenue and activity
  const params = new URLSearchParams()

  if (revenue === "low") {
    params.set("prihod", "low")
  } else if (revenue === "medium") {
    params.set("prihod", "medium")
  }

  if (activity && activity !== "ostalo") {
    params.set("djelatnost", activity)
  }

  return {
    type: "comparison",
    path: "/usporedba/pocinjem-solo",
    params,
  }
}

export function buildPersonalizationParams(answers: WizardAnswer[]): URLSearchParams {
  // This function is kept for backwards compatibility but now mainly handled by getWizardResult
  const params = new URLSearchParams()

  const revenueMap: Record<string, string> = {
    low: "low",
    medium: "medium",
    high: "high",
  }

  const revenue = answers.find((a) => a.questionId === "revenue")?.value
  if (revenue && revenueMap[revenue]) {
    params.set("prihod", revenueMap[revenue])
  }

  const activity = answers.find((a) => a.questionId === "activity")?.value
  if (activity && activity !== "ostalo") {
    params.set("djelatnost", activity)
  }

  const employment = answers.find((a) => a.questionId === "employment")?.value
  if (employment === "retired") {
    params.set("varijanta", "umirovljenik")
  } else if (employment === "student") {
    params.set("varijanta", "student")
  }

  const intent = answers.find((a) => a.questionId === "intent")?.value
  if (intent === "partners") {
    params.set("tip", "viseclano")
  }

  return params
}
