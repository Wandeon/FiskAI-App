// src/lib/regulatory-truth/eval/rules/vat-registration-hr.ts
/**
 * VAT Registration Rule for Croatia
 *
 * Source: Zakon o izmjenama i dopunama Zakona o PDV-u
 * NN 152/2024, Članak 90, Stavak 1
 * Effective: 1.1.2025
 *
 * Threshold: 60.000 EUR annual domestic turnover
 */

import type { Assertion } from "../assertion-schema"
import { ASSERTION_SCHEMA_VERSION, generateAssertionId } from "../assertion-schema"
import type { Rule } from "../rule-dsl"
import { DSL_VERSION, generateRuleId } from "../rule-dsl"

// =============================================================================
// Evidence Reference (to be populated when evidence is stored)
// =============================================================================

// These IDs will be populated when the evidence is actually stored in the database
// For now, using placeholder values that will be replaced in production

export const PDV_THRESHOLD_EVIDENCE = {
  evidenceId: "evd_pdv_nn_152_2024_2508",
  parseSnapshotId: "ps_pdv_nn_152_2024_2508",
  nodeKey: "/zakon/clanak:90/stavak:1",
  nodeLabel: "Članak 90. stavak 1.",
  nn: {
    year: 2024,
    issue: 152,
    item: 2508,
  },
  url: "https://narodne-novine.nn.hr/clanci/sluzbeni/2024_12_152_2508.html",
}

// =============================================================================
// Assertion: PDV Threshold
// =============================================================================

export const PDV_THRESHOLD_ASSERTION: Assertion = {
  schemaVersion: ASSERTION_SCHEMA_VERSION,
  assertionId: generateAssertionId(),
  assertionType: "THRESHOLD",

  topic: {
    domain: "TAX",
    area: "VAT",
    subarea: "REGISTRATION",
  },

  subject: {
    code: "VAT_REGISTRATION_OBLIGATION_THRESHOLD",
    labelHr: "Prag za obvezni ulazak u sustav PDV-a",
  },

  jurisdiction: {
    country: "HR",
    authority: "NN",
  },

  value: {
    kind: "MONEY",
    amount: 60000,
    currency: "EUR",
    scale: 1,
  },

  measurementWindow: {
    basis: "TRAILING_12_MONTHS",
    notesHr: "Godišnji promet u tuzemstvu - vrijednost isporuka dobara i usluga.",
  },

  appliesTo: {
    taxpayerScope: ["OBRT", "DOO", "JDOO", "OTHER"],
    registrationType: "MANDATORY",
    voluntaryAllowed: true,
  },

  ruleIntent: {
    effect: "TRIGGERS_REGISTRATION",
    conditionSummaryHr: "Obvezni ulazak u sustav PDV-a kada godišnji promet prijeđe 60.000 EUR.",
  },

  confidence: {
    score: 1.0,
    level: "HIGH",
    reasons: [
      "Single threshold from official source",
      "Clear numeric value",
      "No ambiguity in text",
    ],
  },

  citations: [
    {
      sourceSystem: "NN",
      instrumentHintHr: "Zakon o izmjenama i dopunama Zakona o PDV-u",
      nn: PDV_THRESHOLD_EVIDENCE.nn,
      eliUri: null,
      evidenceId: PDV_THRESHOLD_EVIDENCE.evidenceId,
      parseSnapshotId: PDV_THRESHOLD_EVIDENCE.parseSnapshotId,
      nodeKey: PDV_THRESHOLD_EVIDENCE.nodeKey,
      nodeLabel: PDV_THRESHOLD_EVIDENCE.nodeLabel,
      normSpan: { start: 0, end: 200 }, // Will be populated from actual parse
      quoteHr:
        "čiji godišnji promet u tuzemstvu nije bio veći od 60.000,00 eura oslobođen je plaćanja PDV-a",
    },
  ],

  temporal: {
    effectiveFrom: "2025-01-01",
    effectiveUntil: null,
  },

  raw: {
    extractedFromTextHr:
      "Porezni obveznik sa sjedištem, prebivalištem ili uobičajenim boravištem u tuzemstvu, " +
      "čiji godišnji promet u tuzemstvu nije bio veći od 60.000,00 eura oslobođen je plaćanja PDV-a " +
      "na isporuke dobara i usluga obavljene u tuzemstvu.",
  },
}

// =============================================================================
// Rule: VAT Registration Obligation
// =============================================================================

export const VAT_REGISTRATION_RULE: Rule = {
  dslVersion: DSL_VERSION,
  ruleId: generateRuleId("rule_vat_reg_threshold_hr"),
  ruleType: "OBLIGATION",

  topic: {
    domain: "TAX",
    area: "VAT",
    subarea: "REGISTRATION",
  },

  appliesWhen: {
    op: "gte",
    field: "taxpayer.vat.annualRevenueEurTrailing12m",
    value: 60000,
  },

  then: {
    set: {
      "taxpayer.vat.mustRegisterVAT": true,
    },
    emit: [
      {
        type: "OBLIGATION",
        code: "VAT_REGISTER",
        labelHr: "Obvezan upis u registar obveznika PDV-a",
        severity: "HIGH",
        explain: {
          templateHr:
            "Premašen je prag od {threshold} EUR (prihod u zadnjih 12 mj: {revenue} EUR).",
          data: {
            threshold: 60000,
            revenueField: "taxpayer.vat.annualRevenueEurTrailing12m",
          },
        },
      },
    ],
  },

  else: {
    set: {
      "taxpayer.vat.mustRegisterVAT": false,
    },
  },

  sources: [
    {
      assertionId: PDV_THRESHOLD_ASSERTION.assertionId,
      citations: [
        {
          evidenceId: PDV_THRESHOLD_EVIDENCE.evidenceId,
          parseSnapshotId: PDV_THRESHOLD_EVIDENCE.parseSnapshotId,
          nodeKey: PDV_THRESHOLD_EVIDENCE.nodeKey,
          normSpan: { start: 0, end: 200 },
        },
      ],
    },
  ],

  confidence: {
    policy: "AUTO_PUBLISH_IF_EXECUTABLE",
    level: "HIGH",
    reasons: ["single-threshold-single-field"],
  },

  executable: true,
}

// =============================================================================
// Formatted Citation for Display
// =============================================================================

export function getVatThresholdCitationLabel(): string {
  return `Zakon o PDV-u, čl. 90, st. 1 (NN ${PDV_THRESHOLD_EVIDENCE.nn.issue}/${PDV_THRESHOLD_EVIDENCE.nn.year})`
}
