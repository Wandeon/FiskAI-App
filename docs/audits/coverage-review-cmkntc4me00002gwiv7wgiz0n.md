# Coverage Review Report

**Evidence ID:** cmkntc4me00002gwiv7wgiz0n
**URL:** https://narodne-novine.nn.hr/clanci/sluzbeni/2020_01_1_1.html
**Document:** Pravilnik o paušalnom oporezivanju samostalnih djelatnosti​
**Generated:** 2026-01-21T09:45:16.017Z

## Verdict

| Metric                | Value    |
| --------------------- | -------- |
| Ready for Auto-Ingest | **NO ✗** |
| Confidence            | LOW      |
| Coverage              | 38%      |
| Bindable              | 0%       |
| Quality Accuracy      | 37%      |

### Blockers

- ❌ Low coverage: only 38% of nodes have assertions
- ❌ 13 nodes with numeric values but no THRESHOLD/RATE extracted
- ❌ Only 0% of assertions are bindable to evaluation context
- ❌ Quality accuracy only 37%

### Next Fixes (ordered)

1. Improve extraction prompt to capture more assertions
2. Add numeric value extraction patterns for Croatian formats
3. Add binder mappings for: pausalni-porez (26), zaštita privatnosti (1), autorsko pravo (1)

### Assessment (Croatian)

> Dokument NIJE spreman za automatsku obradu. Problemi: Low coverage: only 38% of nodes have assertions; 13 nodes with numeric values but no THRESHOLD/RATE extracted; Only 0% of assertions are bindable to evaluation context; Quality accuracy only 37%. Potrebne izmjene: Improve extraction prompt to capture more assertions; Add numeric value extraction patterns for Croatian formats; Add binder mappings for: pausalni-porez (26), zaštita privatnosti (1), autorsko pravo (1).

---

## 1. Structural Coverage

| Level     | Total  | Covered | %       |
| --------- | ------ | ------- | ------- |
| article   | 13     | 4       | 31%     |
| paragraph | 45     | 21      | 47%     |
| point     | 26     | 7       | 27%     |
| **TOTAL** | **84** | **32**  | **38%** |

### Critical: Numeric Values Not Extracted

- **/članak:3**: 31 numeric values detected
  > "Članak 3. (1) Godišnji paušalni dohodak za samostalnu djelatnost iz članka 2. stavka 1. i 7. ovoga P..."
- **/članak:3/stavak:1**: 30 numeric values detected
  > "(1) Godišnji paušalni dohodak za samostalnu djelatnost iz članka 2. stavka 1. i 7. ovoga Pravilnika ..."
- **/članak:3/stavak:4**: 1 numeric values detected
  > "(4) U slučaju nastanka porezne obveze (početka obavljanja samostalne djelatnosti) odnosno prestanka ..."
- **/članak:4**: 2 numeric values detected
  > "Članak 4. (1) Godišnji paušalni porez na dohodak utvrđuje se primjenom porezne stope od 12% sukladno..."
- **/članak:4/stavak:3**: 1 numeric values detected
  > "(3) Mjesečni paušalni porez na dohodak utvrđuje se na način da se godišnji paušalni porez na dohodak..."
- **/članak:5**: 1 numeric values detected
  > "Članak 5. Porezni obveznici iz članka 2. stavka 1. ovoga Pravilnika koji samostalne djelatnosti obav..."
- **/članak:7**: 1 numeric values detected
  > "Članak 7. (1) Porezni obveznik koji porez na dohodak od samostalne djelatnosti plaća u paušalnom izn..."
- **/članak:7/stavak:4**: 1 numeric values detected
  > "(4) Porezni obveznik/nositelj i supoduzetnik u zajedničke djelatnosti koji porez na dohodak od samos..."
- **/članak:8**: 1 numeric values detected
  > "Članak 8. (1) Nositelj zajedničke djelatnosti koji porez na dohodak od zajedničke samostalne djelatn..."
- **/članak:8/stavak:1**: 1 numeric values detected
  > "(1) Nositelj zajedničke djelatnosti koji porez na dohodak od zajedničke samostalne djelatnosti utvrđ..."

---

## 2. Usability Classification

| Classification            | Count | %   |
| ------------------------- | ----- | --- |
| Bindable (executable)     | 0     | 0%  |
| Unbound (missing mapping) | 30    | 48% |
| Reference only            | 24    | -   |
| Needs resolution          | 9     | -   |

### Top Missing Bindings

- pausalni-porez (26)
- zaštita privatnosti (1)
- autorsko pravo (1)
- nadležnost (1)
- podaci (1)

---

## 3. Quality Sampling

**Sample size:** 30
**Strategy:** Deterministic verification (N>=12), LLM for hard cases only (max 5)
**Overall accuracy:** 37%

### Accuracy by Type

| Type        | Sampled | Passed | Accuracy |
| ----------- | ------- | ------ | -------- |
| THRESHOLD   | 3       | 3      | 100%     |
| RATE        | 2       | 2      | 100%     |
| DEADLINE    | 3       | 0      | 0%       |
| OBLIGATION  | 4       | 2      | 50%      |
| PROCEDURE   | 4       | 1      | 25%      |
| REFERENCE   | 4       | 3      | 75%      |
| DEFINITION  | 4       | 0      | 0%       |
| PROHIBITION | 4       | 0      | 0%       |
| EXCEPTION   | 2       | 0      | 0%       |
