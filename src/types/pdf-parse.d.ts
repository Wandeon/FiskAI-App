// Type declarations for pdf-parse
declare module "pdf-parse" {
  interface PDFParseOptions {
    pagerender?: (pageData: {
      getTextContent: () => Promise<{
        items: Array<{ str: string }>
      }>
    }) => Promise<string>
  }

  interface PDFParseResult {
    numpages: number
    numrender: number
    info: Record<string, unknown>
    metadata: Record<string, unknown>
    text: string
    version: string
  }

  function pdfParse(dataBuffer: Buffer, options?: PDFParseOptions): Promise<PDFParseResult>
  export default pdfParse
}
