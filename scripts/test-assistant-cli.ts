import { config } from "dotenv"
config()

import { buildAnswer } from "@/lib/assistant/query-engine/answer-builder"
import { Surface } from "@/lib/assistant/types"

const QUESTIONS = [
  // VAT / PDV
  {
    q: "Koja je stopa PDV-a u Hrvatskoj?",
    expectedIntent: "EXPLAIN",
  },
  {
    q: "Kada moram ući u sustav PDV-a?",
    expectedIntent: "DEADLINE/THRESHOLD",
  },
  {
    q: "Ako prijeđem prag PDV-a u listopadu, od kada se moram prijaviti?",
    expectedIntent: "DEADLINE",
  },
  {
    q: "Postoje li snižene stope PDV-a i na što se odnose?",
    expectedIntent: "EXPLAIN",
  },

  // Thresholds / Personalization Triggers
  // (5–7 MUST trigger MISSING_CLIENT_DATA on MARKETING)
  {
    q: "Koliko mi još preostaje do praga za PDV?",
    expectedIntent: "CALCULATE",
    surface: "MARKETING" as Surface,
  },
  {
    q: "Jesam li već blizu ulaska u PDV?",
    expectedIntent: "CHECK_STATUS",
    surface: "MARKETING" as Surface,
  },
  {
    q: "Moram li se registrirati za PDV ako imam 38.000 € prometa?",
    expectedIntent: "CHECK_STATUS",
    surface: "MARKETING" as Surface,
  },

  // Paušalni obrt
  {
    q: "Koji je maksimalni prihod za paušalni obrt?",
    expectedIntent: "THRESHOLD",
  },
  {
    q: "Što se događa ako paušalni obrt prijeđe prag?",
    expectedIntent: "EXPLAIN",
  },
  {
    q: "Koje poreze plaća paušalni obrtnik?",
    expectedIntent: "LIST",
  },

  // Deadlines & Obligations
  {
    q: "Koji su porezni rokovi ovaj mjesec?",
    expectedIntent: "DEADLINE",
  },
  {
    q: "Do kada se plaćaju doprinosi?",
    expectedIntent: "DEADLINE",
  },
  {
    q: "Koje obveze imam prema Poreznoj upravi kao obrtnik?",
    expectedIntent: "LIST",
  },

  // Fiscalization / e-Invoices
  {
    q: "Tko mora imati fiskalizaciju?",
    expectedIntent: "EXPLAIN",
  },
  {
    q: "Moram li izdavati e-račune?",
    expectedIntent: "CHECK_STATUS",
  },

  // Ambiguous / Needs Clarification
  {
    q: "Koliko poreza moram platiti?",
    expectedIntent: "CALCULATE",
    expectedResult: "REFUSAL (Clarification)",
  },
  {
    q: "Što ako kasnim s prijavom?",
    expectedIntent: "EXPLAIN",
    expectedResult: "REFUSAL (Clarification)",
  },

  // Conflict / Edge Cases
  {
    q: "Vrijedi li još uvijek stari prag za PDV?",
    expectedIntent: "CHECK_STATUS",
  },

  // Gibberish / Fail-Closed
  {
    q: "asdfghjkl qwerty porez xyz",
    expectedIntent: "NONSENSE",
    expectedResult: "REFUSAL",
  },
  {
    q: "Reci mi nešto o porezima",
    expectedIntent: "VAGUE",
    expectedResult: "REFUSAL (Clarification)",
  },
]

async function runTest() {
  console.log("Starting FiskAI Assistant E2E Test...\n")
  console.log(
    "| ID | Question | Surface | Expected Intent | Result Kind | Refusal Reason | Citations | Pass/Fail |"
  )
  console.log("|---|---|---|---|---|---|---|---|")

  let id = 1
  for (const item of QUESTIONS) {
    const surface = item.surface || "MARKETING"
    try {
      const start = Date.now()
      const response = await buildAnswer(item.q, surface)
      const duration = Date.now() - start

      const citationCount =
        response.kind === "ANSWER" ? (response.citations as any)?.rules?.length || 0 : 0
      let pass = true
      let reason = ""

      // Evaluation Logic
      if (item.expectedResult === "REFUSAL" && response.kind !== "REFUSAL") {
        pass = false
        reason = "Expected REFUSAL, got ANSWER"
      } else if (
        item.expectedResult === "REFUSAL (Clarification)" &&
        (response.kind !== "REFUSAL" || response.refusalReason !== "NEEDS_CLARIFICATION")
      ) {
        pass = false
        reason = `Expected NEEDS_CLARIFICATION, got ${response.kind} / ${response.refusalReason}`
      } else if (response.kind === "ANSWER" && citationCount === 0) {
        pass = false
        reason = "ANSWER without citations"
      } else if (
        [5, 6, 7].includes(id) &&
        surface === "MARKETING" &&
        response.kind !== "REFUSAL" &&
        response.refusalReason !== "MISSING_CLIENT_DATA"
      ) {
        pass = false
        reason = "Expected MISSING_CLIENT_DATA on MARKETING"
      } else if (
        id === 19 &&
        response.kind !== "REFUSAL" &&
        response.refusalReason !== "OUT_OF_SCOPE"
      ) {
        pass = false // Gibberish check
        reason = "Gibberish should be OUT_OF_SCOPE"
      }

      console.log(
        `| ${id} | "${item.q}" | ${surface} | ${item.expectedIntent} | ${response.kind} | ${response.refusalReason || "-"} | ${citationCount} | ${pass ? "PASS" : "FAIL " + reason} |`
      )

      // UX Quality Check (brief)
      if (response.kind === "ANSWER" && response.directAnswer.length > 500) {
        console.warn(
          `[WARN] Question ${id} answer is very long (${response.directAnswer.length} chars)`
        )
      }
    } catch (error) {
      console.error(
        `| ${id} | "${item.q}" | ${surface} | ERROR | - | - | - | FAIL Exception: ${error} |`
      )
    }
    id++
  }
}

runTest().catch(console.error)
