import { createHash } from "crypto"

import { storeArtifact } from "@/lib/artifacts/service"
import { generatePdvFormForPeriod } from "@/lib/reports/pdv-xml-generator"

export const PDV_XML_GENERATOR_VERSION = "pdv-xml@1"

export async function generatePdvXmlArtifact(params: {
  companyId: string
  dateFrom: Date
  dateTo: Date
  createdById?: string | null
  reason?: string | null
}) {
  const { xml, data } = await generatePdvFormForPeriod(
    params.companyId,
    params.dateFrom,
    params.dateTo,
    {
      generatedAt: params.dateTo,
      formattedOutput: true,
      includeDeclaration: true,
    }
  )

  const inputSnapshot = {
    companyId: params.companyId,
    dateFrom: params.dateFrom.toISOString(),
    dateTo: params.dateTo.toISOString(),
    data,
  }

  const inputHash = createHash("sha256").update(JSON.stringify(inputSnapshot)).digest("hex")
  const periodStr =
    data.periodType === "MONTHLY"
      ? `${data.periodYear}-${String(data.periodMonth).padStart(2, "0")}`
      : `${data.periodYear}-Q${data.periodQuarter}`
  const fileName = `PDV-${data.companyOib}-${periodStr}.xml`

  const artifact = await storeArtifact({
    companyId: params.companyId,
    type: "XML",
    fileName,
    contentType: "application/xml",
    data: Buffer.from(xml, "utf8"),
    createdById: params.createdById ?? null,
    reason: params.reason ?? "pdv_xml_generate",
    generatorVersion: PDV_XML_GENERATOR_VERSION,
    inputHash,
    generationMeta: {
      artifactKind: "PDV_XML",
      periodType: data.periodType,
      periodYear: data.periodYear,
      periodMonth: data.periodMonth ?? null,
      periodQuarter: data.periodQuarter ?? null,
      companyOib: data.companyOib,
    },
  })

  return { artifact, xml, data, inputHash }
}
