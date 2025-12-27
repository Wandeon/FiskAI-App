// Type declaration for pdf417-generator library
declare module "pdf417-generator" {
  export interface PDF417Options {
    columns?: number
    errorLevel?: number
  }

  export interface PDF417ToSVGOptions {
    width?: number
    height?: number
    color?: string
    backgroundColor?: string
  }

  export interface PDF417Barcode {
    toSVG(options?: PDF417ToSVGOptions): string
  }

  export const PDF417: {
    encode(data: string, options?: PDF417Options): PDF417Barcode
  }
}
