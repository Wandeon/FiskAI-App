# Coverage Review Report

**Evidence ID:** cmkivgiit001801rtfn33iza3
**URL:** https://narodne-novine.nn.hr/clanci/sluzbeni/2025_12_158_2396.html
**Document:** Pravilnik o izmjenama i dopunama Pravilnika o automatskoj razmjeni informacija u području poreza
**Generated:** 2026-01-21T08:46:35.455Z

## Verdict

| Metric                | Value    |
| --------------------- | -------- |
| Ready for Auto-Ingest | **NO ✗** |
| Confidence            | LOW      |
| Coverage              | 49%      |
| Bindable              | 0%       |
| Quality Accuracy      | 20%      |

### Blockers

- ❌ Low coverage: only 49% of nodes have assertions
- ❌ 24 nodes with numeric values but no THRESHOLD/RATE extracted
- ❌ Only 0% of assertions are bindable to evaluation context
- ❌ Quality accuracy only 20%

### Next Fixes (ordered)

1. Improve extraction prompt to capture more assertions
2. Add numeric value extraction patterns for Croatian formats
3. Add binder mappings for: porezni obveznici (19), subjekti (18), izvještavanje (12)
4. Fix top failure mode: Value poorly matches quote (0% overlap) (2x)

### Assessment (Croatian)

> Dokument NIJE spreman za automatsku obradu. Problemi: Low coverage: only 49% of nodes have assertions; 24 nodes with numeric values but no THRESHOLD/RATE extracted; Only 0% of assertions are bindable to evaluation context; Quality accuracy only 20%. Potrebne izmjene: Improve extraction prompt to capture more assertions; Add numeric value extraction patterns for Croatian formats; Add binder mappings for: porezni obveznici (19), subjekti (18), izvještavanje (12); Fix top failure mode: Value poorly matches quote (0% overlap) (2x).

---

## 1. Structural Coverage

| Level     | Total   | Covered | %       |
| --------- | ------- | ------- | ------- |
| article   | 24      | 3       | 13%     |
| paragraph | 161     | 101     | 63%     |
| point     | 149     | 59      | 40%     |
| **TOTAL** | **334** | **163** | **49%** |

### Critical: Numeric Values Not Extracted

- **/članak:4**: 3 numeric values detected
  > "Članak 4. Članak 7. mijenja se i glasi: »(1) Financijska institucija podrazumijeva skrbničku institu..."
- **/članak:4/stavak:2**: 1 numeric values detected
  > "(2) Skrbnička institucija podrazumijeva svaki subjekt čiji se značajan dio poslovanja odnosi na drža..."
- **/članak:4/stavak:5**: 1 numeric values detected
  > "(5) Smatra se da poslovanje subjekta prvenstveno obuhvaća najmanje jednu aktivnost iz stavka 4. točk..."
- **/članak:4/stavak:7**: 1 numeric values detected
  > "(7) Investicijski subjekt ne podrazumijeva subjekt koji je aktivni nefinancijski subjekt jer taj sub..."
- **/članak:6**: 2 numeric values detected
  > "Članak 6. Iza članka 8. dodaju se novi članci 8.a do 8.f i naslovi iznad njih koji glase: »Pojam ele..."
- **/članak:6/stavak:2**: 1 numeric values detected
  > "(2) Pojam elektronički novac ili e-novac ne podrazumijeva proizvod stvoren isključivo radi lakšeg pr..."
- **/članak:11**: 5 numeric values detected
  > "Članak 11. Članak 30. stavak 1. mijenja se i glasi: »(1) Isključeni račun podrazumijeva bilo koji od..."
- **/članak:15**: 11 numeric values detected
  > "Članak 15. Iza dodanog novog članka 57.zh dodaju se članci 57.zi do 57.cc i naslovima iznad njih koj..."
- **/članak:15/stavak:2**: 2 numeric values detected
  > "(2) Elektronički novac ne uključuje proizvod stvoren isključivo radi lakšeg prijenosa sredstava od k..."
- **/članak:15/stavak:2/točka:2**: 1 numeric values detected
  > "2. svaku razmjenu između jednog oblika kriptoimovine o kojoj se izvješćuje ili više njih. Pojam malo..."

---

## 2. Usability Classification

| Classification            | Count | %   |
| ------------------------- | ----- | --- |
| Bindable (executable)     | 0     | 0%  |
| Unbound (missing mapping) | 146   | 30% |
| Reference only            | 92    | -   |
| Needs resolution          | 255   | -   |

### Top Missing Bindings

- porezni obveznici (19)
- subjekti (18)
- izvještavanje (12)
- nadležnost (9)
- podaci (7)
- nadležno tijelo (6)
- kriptoimovina (6)
- porezno izvještavanje (5)
- porezno pravo (5)
- porezna administracija (4)

---

## 3. Quality Sampling

**Sample size:** 30
**Strategy:** Deterministic verification (N>=12), LLM for hard cases only (max 5)
**Overall accuracy:** 20%

### Accuracy by Type

| Type        | Sampled | Passed | Accuracy |
| ----------- | ------- | ------ | -------- |
| THRESHOLD   | 3       | 0      | 0%       |
| RATE        | 3       | 1      | 33%      |
| DEADLINE    | 3       | 1      | 33%      |
| REFERENCE   | 3       | 1      | 33%      |
| OBLIGATION  | 3       | 0      | 0%       |
| PROCEDURE   | 3       | 2      | 67%      |
| EXCEPTION   | 3       | 0      | 0%       |
| PROHIBITION | 3       | 0      | 0%       |
| ENTITY      | 3       | 1      | 33%      |
| DEFINITION  | 3       | 0      | 0%       |

### Top Failure Modes

- Value poorly matches quote (0% overlap) (2x)
- Value poorly matches quote (33% overlap) (2x)
- Value poorly matches quote (25% overlap) (1x)
