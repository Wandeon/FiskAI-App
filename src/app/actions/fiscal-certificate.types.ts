export interface UploadCertificateInput {
  p12Base64: string
  password: string
  environment: "TEST" | "PROD"
}

export interface CertificateInfo {
  subject: string
  oib: string
  serial: string
  notBefore: Date
  notAfter: Date
  issuer: string
  sha256: string
}
