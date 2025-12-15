// src/lib/fiscal/xml-signer.ts
import { SignedXml } from 'xml-crypto'
import { DOMParser } from '@xmldom/xmldom'

export interface SigningCredentials {
  privateKeyPem: string
  certificatePem: string
}

export function signXML(xml: string, credentials: SigningCredentials): string {
  const sig = new SignedXml({
    privateKey: credentials.privateKeyPem,
    publicCert: credentials.certificatePem,
    signatureAlgorithm: 'http://www.w3.org/2001/04/xmldsig-more#rsa-sha256',
    canonicalizationAlgorithm: 'http://www.w3.org/2001/10/xml-exc-c14n#',
    // Include KeyInfo with X509 certificate
    getKeyInfoContent: () => {
      return `<X509Data><X509Certificate>${
        extractCertificateBase64(credentials.certificatePem)
      }</X509Certificate></X509Data>`
    }
  })

  // Add reference to the RacunZahtjev element
  sig.addReference({
    xpath: "//*[@Id='RacunZahtjev']",
    digestAlgorithm: 'http://www.w3.org/2001/04/xmlenc#sha256',
    transforms: [
      'http://www.w3.org/2000/09/xmldsig#enveloped-signature',
      'http://www.w3.org/2001/10/xml-exc-c14n#'
    ]
  })

  // Compute signature
  sig.computeSignature(xml, {
    location: {
      reference: "//*[local-name()='RacunZahtjev']",
      action: 'append'
    }
  })

  return sig.getSignedXml()
}

function extractCertificateBase64(pem: string): string {
  return pem
    .replace(/-----BEGIN CERTIFICATE-----/g, '')
    .replace(/-----END CERTIFICATE-----/g, '')
    .replace(/\s/g, '')
}
