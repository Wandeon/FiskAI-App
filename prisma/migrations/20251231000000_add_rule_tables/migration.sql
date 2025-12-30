-- CreateTable
CREATE TABLE IF NOT EXISTS "RuleTable" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RuleTable_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "RuleVersion" (
    "id" TEXT NOT NULL,
    "tableId" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "effectiveUntil" TIMESTAMP(3),
    "data" JSONB NOT NULL,
    "dataHash" TEXT NOT NULL,
    "publishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RuleVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "RuleSnapshot" (
    "id" TEXT NOT NULL,
    "ruleVersionId" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "dataHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RuleSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "RuleCalculation" (
    "id" TEXT NOT NULL,
    "ruleVersionId" TEXT NOT NULL,
    "tableKey" TEXT NOT NULL,
    "input" JSONB NOT NULL,
    "result" JSONB NOT NULL,
    "referenceDate" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RuleCalculation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "RuleTable_key_key" ON "RuleTable"("key");
CREATE INDEX IF NOT EXISTS "RuleTable_key_idx" ON "RuleTable"("key");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "RuleVersion_tableId_version_key" ON "RuleVersion"("tableId", "version");
CREATE INDEX IF NOT EXISTS "RuleVersion_tableId_effectiveFrom_idx" ON "RuleVersion"("tableId", "effectiveFrom");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "RuleSnapshot_ruleVersionId_idx" ON "RuleSnapshot"("ruleVersionId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "RuleCalculation_tableKey_idx" ON "RuleCalculation"("tableKey");
CREATE INDEX IF NOT EXISTS "RuleCalculation_ruleVersionId_idx" ON "RuleCalculation"("ruleVersionId");
CREATE INDEX IF NOT EXISTS "RuleCalculation_referenceDate_idx" ON "RuleCalculation"("referenceDate");

-- AddForeignKey
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'RuleVersion_tableId_fkey'
    ) THEN
        ALTER TABLE "RuleVersion" ADD CONSTRAINT "RuleVersion_tableId_fkey"
        FOREIGN KEY ("tableId") REFERENCES "RuleTable"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

-- AddForeignKey
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'RuleSnapshot_ruleVersionId_fkey'
    ) THEN
        ALTER TABLE "RuleSnapshot" ADD CONSTRAINT "RuleSnapshot_ruleVersionId_fkey"
        FOREIGN KEY ("ruleVersionId") REFERENCES "RuleVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

-- AddForeignKey
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'RuleCalculation_ruleVersionId_fkey'
    ) THEN
        ALTER TABLE "RuleCalculation" ADD CONSTRAINT "RuleCalculation_ruleVersionId_fkey"
        FOREIGN KEY ("ruleVersionId") REFERENCES "RuleVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

-- Seed Rule Tables
INSERT INTO "RuleTable" ("id", "key", "name", "description") VALUES
  ('rule_table_vat', 'VAT', 'VAT rates', 'Croatian VAT (PDV) rate table'),
  ('rule_table_municipality_income_tax', 'MUNICIPALITY_INCOME_TAX', 'Municipality income tax', 'Municipality surtax/prirez rates'),
  ('rule_table_contributions', 'CONTRIBUTIONS', 'Contributions', 'Self-employed contribution rates and bases'),
  ('rule_table_per_diem', 'PER_DIEM', 'Per diem', 'Non-taxable per diem allowances'),
  ('rule_table_mileage', 'MILEAGE', 'Mileage', 'Non-taxable mileage allowances'),
  ('rule_table_joppd_codebook', 'JOPPD_CODEBOOK', 'JOPPD codebook', 'Codebook for JOPPD reporting')
ON CONFLICT ("id") DO NOTHING;

-- Seed Rule Versions + Snapshots
INSERT INTO "RuleVersion" ("id", "tableId", "version", "effectiveFrom", "data", "dataHash") VALUES
  (
    'rule_version_vat_2025',
    'rule_table_vat',
    '2025-01-01',
    '2025-01-01',
    $$
    {
      "year": 2025,
      "lastVerified": "2025-01-15",
      "source": "https://www.porezna-uprava.hr/HR_porezni_sustav/Stranice/pdv.aspx",
      "standard": { "rate": 0.25, "label": "Standardna stopa", "description": "Opća stopa PDV-a u Hrvatskoj" },
      "reduced": [
        { "rate": 0.13, "label": "Snižena stopa", "description": "Usluge smještaja, ugostiteljstvo, novine i odabrani proizvodi" },
        { "rate": 0.05, "label": "Snižena stopa II", "description": "Osnovne namirnice, knjige, lijekovi i medicinski proizvodi" }
      ]
    }
    $$::jsonb,
    md5($$
    {
      "year": 2025,
      "lastVerified": "2025-01-15",
      "source": "https://www.porezna-uprava.hr/HR_porezni_sustav/Stranice/pdv.aspx",
      "standard": { "rate": 0.25, "label": "Standardna stopa", "description": "Opća stopa PDV-a u Hrvatskoj" },
      "reduced": [
        { "rate": 0.13, "label": "Snižena stopa", "description": "Usluge smještaja, ugostiteljstvo, novine i odabrani proizvodi" },
        { "rate": 0.05, "label": "Snižena stopa II", "description": "Osnovne namirnice, knjige, lijekovi i medicinski proizvodi" }
      ]
    }
    $$)
  ),
  (
    'rule_version_municipality_income_tax_2025',
    'rule_table_municipality_income_tax',
    '2025-01-01',
    '2025-01-01',
    $$
    {
      "year": 2025,
      "lastVerified": "2025-01-15",
      "source": "https://www.porezna-uprava.hr/",
      "entries": [
        { "postalCode": "10000", "city": "Zagreb", "municipality": "Grad Zagreb", "county": "Grad Zagreb", "prirezRate": 0.18 },
        { "postalCode": "21000", "city": "Split", "municipality": "Grad Split", "county": "Splitsko-dalmatinska županija", "prirezRate": 0.15 },
        { "postalCode": "21230", "city": "Sinj", "municipality": "Grad Sinj", "county": "Splitsko-dalmatinska županija", "prirezRate": 0.1 },
        { "postalCode": "21260", "city": "Imotski", "municipality": "Grad Imotski", "county": "Splitsko-dalmatinska županija", "prirezRate": 0.08 },
        { "postalCode": "51000", "city": "Rijeka", "municipality": "Grad Rijeka", "county": "Primorsko-goranska županija", "prirezRate": 0.15 },
        { "postalCode": "51410", "city": "Opatija", "municipality": "Grad Opatija", "county": "Primorsko-goranska županija", "prirezRate": 0.12 },
        { "postalCode": "51500", "city": "Krk", "municipality": "Grad Krk", "county": "Primorsko-goranska županija", "prirezRate": 0.1 },
        { "postalCode": "31000", "city": "Osijek", "municipality": "Grad Osijek", "county": "Osječko-baranjska županija", "prirezRate": 0.13 },
        { "postalCode": "31500", "city": "Našice", "municipality": "Grad Našice", "county": "Osječko-baranjska županija", "prirezRate": 0.1 },
        { "postalCode": "52100", "city": "Pula", "municipality": "Grad Pula", "county": "Istarska županija", "prirezRate": 0.15 },
        { "postalCode": "52000", "city": "Pazin", "municipality": "Grad Pazin", "county": "Istarska županija", "prirezRate": 0.1 },
        { "postalCode": "52210", "city": "Rovinj", "municipality": "Grad Rovinj", "county": "Istarska županija", "prirezRate": 0.12 },
        { "postalCode": "52440", "city": "Poreč", "municipality": "Grad Poreč", "county": "Istarska županija", "prirezRate": 0.12 },
        { "postalCode": "23000", "city": "Zadar", "municipality": "Grad Zadar", "county": "Zadarska županija", "prirezRate": 0.12 },
        { "postalCode": "23250", "city": "Pag", "municipality": "Grad Pag", "county": "Zadarska županija", "prirezRate": 0.06 },
        { "postalCode": "42000", "city": "Varaždin", "municipality": "Grad Varaždin", "county": "Varaždinska županija", "prirezRate": 0.12 },
        { "postalCode": "44000", "city": "Sisak", "municipality": "Grad Sisak", "county": "Sisačko-moslavačka županija", "prirezRate": 0.1 },
        { "postalCode": "47000", "city": "Karlovac", "municipality": "Grad Karlovac", "county": "Karlovačka županija", "prirezRate": 0.12 },
        { "postalCode": "48000", "city": "Koprivnica", "municipality": "Grad Koprivnica", "county": "Koprivničko-križevačka županija", "prirezRate": 0.1 },
        { "postalCode": "48260", "city": "Križevci", "municipality": "Grad Križevci", "county": "Koprivničko-križevačka županija", "prirezRate": 0.1 },
        { "postalCode": "43000", "city": "Bjelovar", "municipality": "Grad Bjelovar", "county": "Bjelovarsko-bilogorska županija", "prirezRate": 0.1 },
        { "postalCode": "33000", "city": "Virovitica", "municipality": "Grad Virovitica", "county": "Virovitičko-podravska županija", "prirezRate": 0.1 },
        { "postalCode": "34000", "city": "Požega", "municipality": "Grad Požega", "county": "Požeško-slavonska županija", "prirezRate": 0.1 },
        { "postalCode": "35000", "city": "Slavonski Brod", "municipality": "Grad Slavonski Brod", "county": "Brodsko-posavska županija", "prirezRate": 0.1 },
        { "postalCode": "32000", "city": "Vukovar", "municipality": "Grad Vukovar", "county": "Vukovarsko-srijemska županija", "prirezRate": 0.1 },
        { "postalCode": "32100", "city": "Vinkovci", "municipality": "Grad Vinkovci", "county": "Vukovarsko-srijemska županija", "prirezRate": 0.1 },
        { "postalCode": "22000", "city": "Šibenik", "municipality": "Grad Šibenik", "county": "Šibensko-kninska županija", "prirezRate": 0.12 },
        { "postalCode": "53000", "city": "Gospić", "municipality": "Grad Gospić", "county": "Ličko-senjska županija", "prirezRate": 0.08 },
        { "postalCode": "40000", "city": "Čakovec", "municipality": "Grad Čakovec", "county": "Međimurska županija", "prirezRate": 0.12 },
        { "postalCode": "49000", "city": "Krapina", "municipality": "Grad Krapina", "county": "Krapinsko-zagorska županija", "prirezRate": 0.1 },
        { "postalCode": "10410", "city": "Velika Gorica", "municipality": "Grad Velika Gorica", "county": "Zagrebačka županija", "prirezRate": 0.12 },
        { "postalCode": "10430", "city": "Samobor", "municipality": "Grad Samobor", "county": "Zagrebačka županija", "prirezRate": 0.12 },
        { "postalCode": "20000", "city": "Dubrovnik", "municipality": "Grad Dubrovnik", "county": "Dubrovačko-neretvanska županija", "prirezRate": 0.15 }
      ]
    }
    $$::jsonb,
    md5($$
    {
      "year": 2025,
      "lastVerified": "2025-01-15",
      "source": "https://www.porezna-uprava.hr/",
      "entries": [
        { "postalCode": "10000", "city": "Zagreb", "municipality": "Grad Zagreb", "county": "Grad Zagreb", "prirezRate": 0.18 },
        { "postalCode": "21000", "city": "Split", "municipality": "Grad Split", "county": "Splitsko-dalmatinska županija", "prirezRate": 0.15 },
        { "postalCode": "21230", "city": "Sinj", "municipality": "Grad Sinj", "county": "Splitsko-dalmatinska županija", "prirezRate": 0.1 },
        { "postalCode": "21260", "city": "Imotski", "municipality": "Grad Imotski", "county": "Splitsko-dalmatinska županija", "prirezRate": 0.08 },
        { "postalCode": "51000", "city": "Rijeka", "municipality": "Grad Rijeka", "county": "Primorsko-goranska županija", "prirezRate": 0.15 },
        { "postalCode": "51410", "city": "Opatija", "municipality": "Grad Opatija", "county": "Primorsko-goranska županija", "prirezRate": 0.12 },
        { "postalCode": "51500", "city": "Krk", "municipality": "Grad Krk", "county": "Primorsko-goranska županija", "prirezRate": 0.1 },
        { "postalCode": "31000", "city": "Osijek", "municipality": "Grad Osijek", "county": "Osječko-baranjska županija", "prirezRate": 0.13 },
        { "postalCode": "31500", "city": "Našice", "municipality": "Grad Našice", "county": "Osječko-baranjska županija", "prirezRate": 0.1 },
        { "postalCode": "52100", "city": "Pula", "municipality": "Grad Pula", "county": "Istarska županija", "prirezRate": 0.15 },
        { "postalCode": "52000", "city": "Pazin", "municipality": "Grad Pazin", "county": "Istarska županija", "prirezRate": 0.1 },
        { "postalCode": "52210", "city": "Rovinj", "municipality": "Grad Rovinj", "county": "Istarska županija", "prirezRate": 0.12 },
        { "postalCode": "52440", "city": "Poreč", "municipality": "Grad Poreč", "county": "Istarska županija", "prirezRate": 0.12 },
        { "postalCode": "23000", "city": "Zadar", "municipality": "Grad Zadar", "county": "Zadarska županija", "prirezRate": 0.12 },
        { "postalCode": "23250", "city": "Pag", "municipality": "Grad Pag", "county": "Zadarska županija", "prirezRate": 0.06 },
        { "postalCode": "42000", "city": "Varaždin", "municipality": "Grad Varaždin", "county": "Varaždinska županija", "prirezRate": 0.12 },
        { "postalCode": "44000", "city": "Sisak", "municipality": "Grad Sisak", "county": "Sisačko-moslavačka županija", "prirezRate": 0.1 },
        { "postalCode": "47000", "city": "Karlovac", "municipality": "Grad Karlovac", "county": "Karlovačka županija", "prirezRate": 0.12 },
        { "postalCode": "48000", "city": "Koprivnica", "municipality": "Grad Koprivnica", "county": "Koprivničko-križevačka županija", "prirezRate": 0.1 },
        { "postalCode": "48260", "city": "Križevci", "municipality": "Grad Križevci", "county": "Koprivničko-križevačka županija", "prirezRate": 0.1 },
        { "postalCode": "43000", "city": "Bjelovar", "municipality": "Grad Bjelovar", "county": "Bjelovarsko-bilogorska županija", "prirezRate": 0.1 },
        { "postalCode": "33000", "city": "Virovitica", "municipality": "Grad Virovitica", "county": "Virovitičko-podravska županija", "prirezRate": 0.1 },
        { "postalCode": "34000", "city": "Požega", "municipality": "Grad Požega", "county": "Požeško-slavonska županija", "prirezRate": 0.1 },
        { "postalCode": "35000", "city": "Slavonski Brod", "municipality": "Grad Slavonski Brod", "county": "Brodsko-posavska županija", "prirezRate": 0.1 },
        { "postalCode": "32000", "city": "Vukovar", "municipality": "Grad Vukovar", "county": "Vukovarsko-srijemska županija", "prirezRate": 0.1 },
        { "postalCode": "32100", "city": "Vinkovci", "municipality": "Grad Vinkovci", "county": "Vukovarsko-srijemska županija", "prirezRate": 0.1 },
        { "postalCode": "22000", "city": "Šibenik", "municipality": "Grad Šibenik", "county": "Šibensko-kninska županija", "prirezRate": 0.12 },
        { "postalCode": "53000", "city": "Gospić", "municipality": "Grad Gospić", "county": "Ličko-senjska županija", "prirezRate": 0.08 },
        { "postalCode": "40000", "city": "Čakovec", "municipality": "Grad Čakovec", "county": "Međimurska županija", "prirezRate": 0.12 },
        { "postalCode": "49000", "city": "Krapina", "municipality": "Grad Krapina", "county": "Krapinsko-zagorska županija", "prirezRate": 0.1 },
        { "postalCode": "10410", "city": "Velika Gorica", "municipality": "Grad Velika Gorica", "county": "Zagrebačka županija", "prirezRate": 0.12 },
        { "postalCode": "10430", "city": "Samobor", "municipality": "Grad Samobor", "county": "Zagrebačka županija", "prirezRate": 0.12 },
        { "postalCode": "20000", "city": "Dubrovnik", "municipality": "Grad Dubrovnik", "county": "Dubrovačko-neretvanska županija", "prirezRate": 0.15 }
      ]
    }
    $$)
  ),
  (
    'rule_version_contributions_2025',
    'rule_table_contributions',
    '2025-01-01',
    '2025-01-01',
    $$
    {
      "year": 2025,
      "lastVerified": "2025-01-15",
      "source": "https://www.hzzo.hr/obveznici-placanja-doprinosa/",
      "rates": {
        "MIO_I": {
          "rate": 0.15,
          "name": "MIO I. stup",
          "nameLong": "Mirovinsko osiguranje - I. stup (generacijska solidarnost)",
          "iban": "HR1210010051863000160",
          "model": "HR68",
          "pozivNaBroj": "OIB-0000-000"
        },
        "MIO_II": {
          "rate": 0.05,
          "name": "MIO II. stup",
          "nameLong": "Mirovinsko osiguranje - II. stup (individualna kapitalizirana štednja)",
          "iban": "HR8724070001007120013",
          "model": "HR68",
          "pozivNaBroj": "OIB-0000-000"
        },
        "HZZO": {
          "rate": 0.165,
          "name": "HZZO",
          "nameLong": "Zdravstveno osiguranje",
          "iban": "HR6510010051550100001",
          "model": "HR68",
          "pozivNaBroj": "OIB-0000-000"
        }
      },
      "base": {
        "minimum": 719.2,
        "maximum": 9360.0,
        "description": "Osnovica za obračun doprinosa obrtnika"
      },
      "monthly": {
        "mioI": 107.88,
        "mioII": 35.96,
        "hzzo": 118.67,
        "total": 262.51
      }
    }
    $$::jsonb,
    md5($$
    {
      "year": 2025,
      "lastVerified": "2025-01-15",
      "source": "https://www.hzzo.hr/obveznici-placanja-doprinosa/",
      "rates": {
        "MIO_I": {
          "rate": 0.15,
          "name": "MIO I. stup",
          "nameLong": "Mirovinsko osiguranje - I. stup (generacijska solidarnost)",
          "iban": "HR1210010051863000160",
          "model": "HR68",
          "pozivNaBroj": "OIB-0000-000"
        },
        "MIO_II": {
          "rate": 0.05,
          "name": "MIO II. stup",
          "nameLong": "Mirovinsko osiguranje - II. stup (individualna kapitalizirana štednja)",
          "iban": "HR8724070001007120013",
          "model": "HR68",
          "pozivNaBroj": "OIB-0000-000"
        },
        "HZZO": {
          "rate": 0.165,
          "name": "HZZO",
          "nameLong": "Zdravstveno osiguranje",
          "iban": "HR6510010051550100001",
          "model": "HR68",
          "pozivNaBroj": "OIB-0000-000"
        }
      },
      "base": {
        "minimum": 719.2,
        "maximum": 9360.0,
        "description": "Osnovica za obračun doprinosa obrtnika"
      },
      "monthly": {
        "mioI": 107.88,
        "mioII": 35.96,
        "hzzo": 118.67,
        "total": 262.51
      }
    }
    $$)
  ),
  (
    'rule_version_per_diem_2025',
    'rule_table_per_diem',
    '2025-01-01',
    '2025-01-01',
    $$
    {
      "year": 2025,
      "lastVerified": "2025-01-15",
      "source": "https://www.porezna-uprava.hr/",
      "domestic": { "rate": 26.54, "unit": "EUR/day" },
      "foreign": { "rate": null, "unit": "EUR/day", "note": "Country-specific rates" }
    }
    $$::jsonb,
    md5($$
    {
      "year": 2025,
      "lastVerified": "2025-01-15",
      "source": "https://www.porezna-uprava.hr/",
      "domestic": { "rate": 26.54, "unit": "EUR/day" },
      "foreign": { "rate": null, "unit": "EUR/day", "note": "Country-specific rates" }
    }
    $$)
  ),
  (
    'rule_version_mileage_2025',
    'rule_table_mileage',
    '2025-01-01',
    '2025-01-01',
    $$
    {
      "year": 2025,
      "lastVerified": "2025-01-15",
      "source": "https://www.porezna-uprava.hr/",
      "rate": 0.4,
      "unit": "EUR/km"
    }
    $$::jsonb,
    md5($$
    {
      "year": 2025,
      "lastVerified": "2025-01-15",
      "source": "https://www.porezna-uprava.hr/",
      "rate": 0.4,
      "unit": "EUR/km"
    }
    $$)
  ),
  (
    'rule_version_joppd_codebook_2025',
    'rule_table_joppd_codebook',
    '2025-01-01',
    '2025-01-01',
    $$
    {
      "year": 2025,
      "lastVerified": "2025-01-15",
      "source": "https://www.porezna-uprava.hr/HR_porezni_sustav/Stranice/joppd.aspx",
      "entries": [
        { "code": "PER_DIEM_DOMESTIC", "label": "Dnevnica (domaća)", "maxAmount": 26.54, "unit": "EUR/day" },
        { "code": "PER_DIEM_FOREIGN", "label": "Inozemna dnevnica", "maxAmount": null, "unit": "EUR/day", "note": "Country-specific" },
        { "code": "MILEAGE_PRIVATE_CAR", "label": "Naknada za km", "maxAmount": 0.4, "unit": "EUR/km" },
        { "code": "CHRISTMAS_BONUS", "label": "Božićnica", "maxAmount": 663.61, "unit": "EUR/year" },
        { "code": "HOLIDAY_BONUS", "label": "Regres", "maxAmount": 331.81, "unit": "EUR/year" },
        { "code": "CHILD_GIFT", "label": "Dar djetetu", "maxAmount": 132.72, "unit": "EUR/child" }
      ]
    }
    $$::jsonb,
    md5($$
    {
      "year": 2025,
      "lastVerified": "2025-01-15",
      "source": "https://www.porezna-uprava.hr/HR_porezni_sustav/Stranice/joppd.aspx",
      "entries": [
        { "code": "PER_DIEM_DOMESTIC", "label": "Dnevnica (domaća)", "maxAmount": 26.54, "unit": "EUR/day" },
        { "code": "PER_DIEM_FOREIGN", "label": "Inozemna dnevnica", "maxAmount": null, "unit": "EUR/day", "note": "Country-specific" },
        { "code": "MILEAGE_PRIVATE_CAR", "label": "Naknada za km", "maxAmount": 0.4, "unit": "EUR/km" },
        { "code": "CHRISTMAS_BONUS", "label": "Božićnica", "maxAmount": 663.61, "unit": "EUR/year" },
        { "code": "HOLIDAY_BONUS", "label": "Regres", "maxAmount": 331.81, "unit": "EUR/year" },
        { "code": "CHILD_GIFT", "label": "Dar djetetu", "maxAmount": 132.72, "unit": "EUR/child" }
      ]
    }
    $$)
  )
ON CONFLICT ("id") DO NOTHING;

INSERT INTO "RuleSnapshot" ("id", "ruleVersionId", "data", "dataHash") VALUES
  (
    'rule_snapshot_vat_2025',
    'rule_version_vat_2025',
    $$
    {
      "year": 2025,
      "lastVerified": "2025-01-15",
      "source": "https://www.porezna-uprava.hr/HR_porezni_sustav/Stranice/pdv.aspx",
      "standard": { "rate": 0.25, "label": "Standardna stopa", "description": "Opća stopa PDV-a u Hrvatskoj" },
      "reduced": [
        { "rate": 0.13, "label": "Snižena stopa", "description": "Usluge smještaja, ugostiteljstvo, novine i odabrani proizvodi" },
        { "rate": 0.05, "label": "Snižena stopa II", "description": "Osnovne namirnice, knjige, lijekovi i medicinski proizvodi" }
      ]
    }
    $$::jsonb,
    md5($$
    {
      "year": 2025,
      "lastVerified": "2025-01-15",
      "source": "https://www.porezna-uprava.hr/HR_porezni_sustav/Stranice/pdv.aspx",
      "standard": { "rate": 0.25, "label": "Standardna stopa", "description": "Opća stopa PDV-a u Hrvatskoj" },
      "reduced": [
        { "rate": 0.13, "label": "Snižena stopa", "description": "Usluge smještaja, ugostiteljstvo, novine i odabrani proizvodi" },
        { "rate": 0.05, "label": "Snižena stopa II", "description": "Osnovne namirnice, knjige, lijekovi i medicinski proizvodi" }
      ]
    }
    $$)
  ),
  (
    'rule_snapshot_municipality_income_tax_2025',
    'rule_version_municipality_income_tax_2025',
    $$
    {
      "year": 2025,
      "lastVerified": "2025-01-15",
      "source": "https://www.porezna-uprava.hr/",
      "entries": [
        { "postalCode": "10000", "city": "Zagreb", "municipality": "Grad Zagreb", "county": "Grad Zagreb", "prirezRate": 0.18 },
        { "postalCode": "21000", "city": "Split", "municipality": "Grad Split", "county": "Splitsko-dalmatinska županija", "prirezRate": 0.15 },
        { "postalCode": "21230", "city": "Sinj", "municipality": "Grad Sinj", "county": "Splitsko-dalmatinska županija", "prirezRate": 0.1 },
        { "postalCode": "21260", "city": "Imotski", "municipality": "Grad Imotski", "county": "Splitsko-dalmatinska županija", "prirezRate": 0.08 },
        { "postalCode": "51000", "city": "Rijeka", "municipality": "Grad Rijeka", "county": "Primorsko-goranska županija", "prirezRate": 0.15 },
        { "postalCode": "51410", "city": "Opatija", "municipality": "Grad Opatija", "county": "Primorsko-goranska županija", "prirezRate": 0.12 },
        { "postalCode": "51500", "city": "Krk", "municipality": "Grad Krk", "county": "Primorsko-goranska županija", "prirezRate": 0.1 },
        { "postalCode": "31000", "city": "Osijek", "municipality": "Grad Osijek", "county": "Osječko-baranjska županija", "prirezRate": 0.13 },
        { "postalCode": "31500", "city": "Našice", "municipality": "Grad Našice", "county": "Osječko-baranjska županija", "prirezRate": 0.1 },
        { "postalCode": "52100", "city": "Pula", "municipality": "Grad Pula", "county": "Istarska županija", "prirezRate": 0.15 },
        { "postalCode": "52000", "city": "Pazin", "municipality": "Grad Pazin", "county": "Istarska županija", "prirezRate": 0.1 },
        { "postalCode": "52210", "city": "Rovinj", "municipality": "Grad Rovinj", "county": "Istarska županija", "prirezRate": 0.12 },
        { "postalCode": "52440", "city": "Poreč", "municipality": "Grad Poreč", "county": "Istarska županija", "prirezRate": 0.12 },
        { "postalCode": "23000", "city": "Zadar", "municipality": "Grad Zadar", "county": "Zadarska županija", "prirezRate": 0.12 },
        { "postalCode": "23250", "city": "Pag", "municipality": "Grad Pag", "county": "Zadarska županija", "prirezRate": 0.06 },
        { "postalCode": "42000", "city": "Varaždin", "municipality": "Grad Varaždin", "county": "Varaždinska županija", "prirezRate": 0.12 },
        { "postalCode": "44000", "city": "Sisak", "municipality": "Grad Sisak", "county": "Sisačko-moslavačka županija", "prirezRate": 0.1 },
        { "postalCode": "47000", "city": "Karlovac", "municipality": "Grad Karlovac", "county": "Karlovačka županija", "prirezRate": 0.12 },
        { "postalCode": "48000", "city": "Koprivnica", "municipality": "Grad Koprivnica", "county": "Koprivničko-križevačka županija", "prirezRate": 0.1 },
        { "postalCode": "48260", "city": "Križevci", "municipality": "Grad Križevci", "county": "Koprivničko-križevačka županija", "prirezRate": 0.1 },
        { "postalCode": "43000", "city": "Bjelovar", "municipality": "Grad Bjelovar", "county": "Bjelovarsko-bilogorska županija", "prirezRate": 0.1 },
        { "postalCode": "33000", "city": "Virovitica", "municipality": "Grad Virovitica", "county": "Virovitičko-podravska županija", "prirezRate": 0.1 },
        { "postalCode": "34000", "city": "Požega", "municipality": "Grad Požega", "county": "Požeško-slavonska županija", "prirezRate": 0.1 },
        { "postalCode": "35000", "city": "Slavonski Brod", "municipality": "Grad Slavonski Brod", "county": "Brodsko-posavska županija", "prirezRate": 0.1 },
        { "postalCode": "32000", "city": "Vukovar", "municipality": "Grad Vukovar", "county": "Vukovarsko-srijemska županija", "prirezRate": 0.1 },
        { "postalCode": "32100", "city": "Vinkovci", "municipality": "Grad Vinkovci", "county": "Vukovarsko-srijemska županija", "prirezRate": 0.1 },
        { "postalCode": "22000", "city": "Šibenik", "municipality": "Grad Šibenik", "county": "Šibensko-kninska županija", "prirezRate": 0.12 },
        { "postalCode": "53000", "city": "Gospić", "municipality": "Grad Gospić", "county": "Ličko-senjska županija", "prirezRate": 0.08 },
        { "postalCode": "40000", "city": "Čakovec", "municipality": "Grad Čakovec", "county": "Međimurska županija", "prirezRate": 0.12 },
        { "postalCode": "49000", "city": "Krapina", "municipality": "Grad Krapina", "county": "Krapinsko-zagorska županija", "prirezRate": 0.1 },
        { "postalCode": "10410", "city": "Velika Gorica", "municipality": "Grad Velika Gorica", "county": "Zagrebačka županija", "prirezRate": 0.12 },
        { "postalCode": "10430", "city": "Samobor", "municipality": "Grad Samobor", "county": "Zagrebačka županija", "prirezRate": 0.12 },
        { "postalCode": "20000", "city": "Dubrovnik", "municipality": "Grad Dubrovnik", "county": "Dubrovačko-neretvanska županija", "prirezRate": 0.15 }
      ]
    }
    $$::jsonb,
    md5($$
    {
      "year": 2025,
      "lastVerified": "2025-01-15",
      "source": "https://www.porezna-uprava.hr/",
      "entries": [
        { "postalCode": "10000", "city": "Zagreb", "municipality": "Grad Zagreb", "county": "Grad Zagreb", "prirezRate": 0.18 },
        { "postalCode": "21000", "city": "Split", "municipality": "Grad Split", "county": "Splitsko-dalmatinska županija", "prirezRate": 0.15 },
        { "postalCode": "21230", "city": "Sinj", "municipality": "Grad Sinj", "county": "Splitsko-dalmatinska županija", "prirezRate": 0.1 },
        { "postalCode": "21260", "city": "Imotski", "municipality": "Grad Imotski", "county": "Splitsko-dalmatinska županija", "prirezRate": 0.08 },
        { "postalCode": "51000", "city": "Rijeka", "municipality": "Grad Rijeka", "county": "Primorsko-goranska županija", "prirezRate": 0.15 },
        { "postalCode": "51410", "city": "Opatija", "municipality": "Grad Opatija", "county": "Primorsko-goranska županija", "prirezRate": 0.12 },
        { "postalCode": "51500", "city": "Krk", "municipality": "Grad Krk", "county": "Primorsko-goranska županija", "prirezRate": 0.1 },
        { "postalCode": "31000", "city": "Osijek", "municipality": "Grad Osijek", "county": "Osječko-baranjska županija", "prirezRate": 0.13 },
        { "postalCode": "31500", "city": "Našice", "municipality": "Grad Našice", "county": "Osječko-baranjska županija", "prirezRate": 0.1 },
        { "postalCode": "52100", "city": "Pula", "municipality": "Grad Pula", "county": "Istarska županija", "prirezRate": 0.15 },
        { "postalCode": "52000", "city": "Pazin", "municipality": "Grad Pazin", "county": "Istarska županija", "prirezRate": 0.1 },
        { "postalCode": "52210", "city": "Rovinj", "municipality": "Grad Rovinj", "county": "Istarska županija", "prirezRate": 0.12 },
        { "postalCode": "52440", "city": "Poreč", "municipality": "Grad Poreč", "county": "Istarska županija", "prirezRate": 0.12 },
        { "postalCode": "23000", "city": "Zadar", "municipality": "Grad Zadar", "county": "Zadarska županija", "prirezRate": 0.12 },
        { "postalCode": "23250", "city": "Pag", "municipality": "Grad Pag", "county": "Zadarska županija", "prirezRate": 0.06 },
        { "postalCode": "42000", "city": "Varaždin", "municipality": "Grad Varaždin", "county": "Varaždinska županija", "prirezRate": 0.12 },
        { "postalCode": "44000", "city": "Sisak", "municipality": "Grad Sisak", "county": "Sisačko-moslavačka županija", "prirezRate": 0.1 },
        { "postalCode": "47000", "city": "Karlovac", "municipality": "Grad Karlovac", "county": "Karlovačka županija", "prirezRate": 0.12 },
        { "postalCode": "48000", "city": "Koprivnica", "municipality": "Grad Koprivnica", "county": "Koprivničko-križevačka županija", "prirezRate": 0.1 },
        { "postalCode": "48260", "city": "Križevci", "municipality": "Grad Križevci", "county": "Koprivničko-križevačka županija", "prirezRate": 0.1 },
        { "postalCode": "43000", "city": "Bjelovar", "municipality": "Grad Bjelovar", "county": "Bjelovarsko-bilogorska županija", "prirezRate": 0.1 },
        { "postalCode": "33000", "city": "Virovitica", "municipality": "Grad Virovitica", "county": "Virovitičko-podravska županija", "prirezRate": 0.1 },
        { "postalCode": "34000", "city": "Požega", "municipality": "Grad Požega", "county": "Požeško-slavonska županija", "prirezRate": 0.1 },
        { "postalCode": "35000", "city": "Slavonski Brod", "municipality": "Grad Slavonski Brod", "county": "Brodsko-posavska županija", "prirezRate": 0.1 },
        { "postalCode": "32000", "city": "Vukovar", "municipality": "Grad Vukovar", "county": "Vukovarsko-srijemska županija", "prirezRate": 0.1 },
        { "postalCode": "32100", "city": "Vinkovci", "municipality": "Grad Vinkovci", "county": "Vukovarsko-srijemska županija", "prirezRate": 0.1 },
        { "postalCode": "22000", "city": "Šibenik", "municipality": "Grad Šibenik", "county": "Šibensko-kninska županija", "prirezRate": 0.12 },
        { "postalCode": "53000", "city": "Gospić", "municipality": "Grad Gospić", "county": "Ličko-senjska županija", "prirezRate": 0.08 },
        { "postalCode": "40000", "city": "Čakovec", "municipality": "Grad Čakovec", "county": "Međimurska županija", "prirezRate": 0.12 },
        { "postalCode": "49000", "city": "Krapina", "municipality": "Grad Krapina", "county": "Krapinsko-zagorska županija", "prirezRate": 0.1 },
        { "postalCode": "10410", "city": "Velika Gorica", "municipality": "Grad Velika Gorica", "county": "Zagrebačka županija", "prirezRate": 0.12 },
        { "postalCode": "10430", "city": "Samobor", "municipality": "Grad Samobor", "county": "Zagrebačka županija", "prirezRate": 0.12 },
        { "postalCode": "20000", "city": "Dubrovnik", "municipality": "Grad Dubrovnik", "county": "Dubrovačko-neretvanska županija", "prirezRate": 0.15 }
      ]
    }
    $$)
  ),
  (
    'rule_snapshot_contributions_2025',
    'rule_version_contributions_2025',
    $$
    {
      "year": 2025,
      "lastVerified": "2025-01-15",
      "source": "https://www.hzzo.hr/obveznici-placanja-doprinosa/",
      "rates": {
        "MIO_I": {
          "rate": 0.15,
          "name": "MIO I. stup",
          "nameLong": "Mirovinsko osiguranje - I. stup (generacijska solidarnost)",
          "iban": "HR1210010051863000160",
          "model": "HR68",
          "pozivNaBroj": "OIB-0000-000"
        },
        "MIO_II": {
          "rate": 0.05,
          "name": "MIO II. stup",
          "nameLong": "Mirovinsko osiguranje - II. stup (individualna kapitalizirana štednja)",
          "iban": "HR8724070001007120013",
          "model": "HR68",
          "pozivNaBroj": "OIB-0000-000"
        },
        "HZZO": {
          "rate": 0.165,
          "name": "HZZO",
          "nameLong": "Zdravstveno osiguranje",
          "iban": "HR6510010051550100001",
          "model": "HR68",
          "pozivNaBroj": "OIB-0000-000"
        }
      },
      "base": {
        "minimum": 719.2,
        "maximum": 9360.0,
        "description": "Osnovica za obračun doprinosa obrtnika"
      },
      "monthly": {
        "mioI": 107.88,
        "mioII": 35.96,
        "hzzo": 118.67,
        "total": 262.51
      }
    }
    $$::jsonb,
    md5($$
    {
      "year": 2025,
      "lastVerified": "2025-01-15",
      "source": "https://www.hzzo.hr/obveznici-placanja-doprinosa/",
      "rates": {
        "MIO_I": {
          "rate": 0.15,
          "name": "MIO I. stup",
          "nameLong": "Mirovinsko osiguranje - I. stup (generacijska solidarnost)",
          "iban": "HR1210010051863000160",
          "model": "HR68",
          "pozivNaBroj": "OIB-0000-000"
        },
        "MIO_II": {
          "rate": 0.05,
          "name": "MIO II. stup",
          "nameLong": "Mirovinsko osiguranje - II. stup (individualna kapitalizirana štednja)",
          "iban": "HR8724070001007120013",
          "model": "HR68",
          "pozivNaBroj": "OIB-0000-000"
        },
        "HZZO": {
          "rate": 0.165,
          "name": "HZZO",
          "nameLong": "Zdravstveno osiguranje",
          "iban": "HR6510010051550100001",
          "model": "HR68",
          "pozivNaBroj": "OIB-0000-000"
        }
      },
      "base": {
        "minimum": 719.2,
        "maximum": 9360.0,
        "description": "Osnovica za obračun doprinosa obrtnika"
      },
      "monthly": {
        "mioI": 107.88,
        "mioII": 35.96,
        "hzzo": 118.67,
        "total": 262.51
      }
    }
    $$)
  ),
  (
    'rule_snapshot_per_diem_2025',
    'rule_version_per_diem_2025',
    $$
    {
      "year": 2025,
      "lastVerified": "2025-01-15",
      "source": "https://www.porezna-uprava.hr/",
      "domestic": { "rate": 26.54, "unit": "EUR/day" },
      "foreign": { "rate": null, "unit": "EUR/day", "note": "Country-specific rates" }
    }
    $$::jsonb,
    md5($$
    {
      "year": 2025,
      "lastVerified": "2025-01-15",
      "source": "https://www.porezna-uprava.hr/",
      "domestic": { "rate": 26.54, "unit": "EUR/day" },
      "foreign": { "rate": null, "unit": "EUR/day", "note": "Country-specific rates" }
    }
    $$)
  ),
  (
    'rule_snapshot_mileage_2025',
    'rule_version_mileage_2025',
    $$
    {
      "year": 2025,
      "lastVerified": "2025-01-15",
      "source": "https://www.porezna-uprava.hr/",
      "rate": 0.4,
      "unit": "EUR/km"
    }
    $$::jsonb,
    md5($$
    {
      "year": 2025,
      "lastVerified": "2025-01-15",
      "source": "https://www.porezna-uprava.hr/",
      "rate": 0.4,
      "unit": "EUR/km"
    }
    $$)
  ),
  (
    'rule_snapshot_joppd_codebook_2025',
    'rule_version_joppd_codebook_2025',
    $$
    {
      "year": 2025,
      "lastVerified": "2025-01-15",
      "source": "https://www.porezna-uprava.hr/HR_porezni_sustav/Stranice/joppd.aspx",
      "entries": [
        { "code": "PER_DIEM_DOMESTIC", "label": "Dnevnica (domaća)", "maxAmount": 26.54, "unit": "EUR/day" },
        { "code": "PER_DIEM_FOREIGN", "label": "Inozemna dnevnica", "maxAmount": null, "unit": "EUR/day", "note": "Country-specific" },
        { "code": "MILEAGE_PRIVATE_CAR", "label": "Naknada za km", "maxAmount": 0.4, "unit": "EUR/km" },
        { "code": "CHRISTMAS_BONUS", "label": "Božićnica", "maxAmount": 663.61, "unit": "EUR/year" },
        { "code": "HOLIDAY_BONUS", "label": "Regres", "maxAmount": 331.81, "unit": "EUR/year" },
        { "code": "CHILD_GIFT", "label": "Dar djetetu", "maxAmount": 132.72, "unit": "EUR/child" }
      ]
    }
    $$::jsonb,
    md5($$
    {
      "year": 2025,
      "lastVerified": "2025-01-15",
      "source": "https://www.porezna-uprava.hr/HR_porezni_sustav/Stranice/joppd.aspx",
      "entries": [
        { "code": "PER_DIEM_DOMESTIC", "label": "Dnevnica (domaća)", "maxAmount": 26.54, "unit": "EUR/day" },
        { "code": "PER_DIEM_FOREIGN", "label": "Inozemna dnevnica", "maxAmount": null, "unit": "EUR/day", "note": "Country-specific" },
        { "code": "MILEAGE_PRIVATE_CAR", "label": "Naknada za km", "maxAmount": 0.4, "unit": "EUR/km" },
        { "code": "CHRISTMAS_BONUS", "label": "Božićnica", "maxAmount": 663.61, "unit": "EUR/year" },
        { "code": "HOLIDAY_BONUS", "label": "Regres", "maxAmount": 331.81, "unit": "EUR/year" },
        { "code": "CHILD_GIFT", "label": "Dar djetetu", "maxAmount": 132.72, "unit": "EUR/child" }
      ]
    }
    $$)
  )
ON CONFLICT ("id") DO NOTHING;
