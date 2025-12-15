// src/lib/fiscal/envelope-encryption.ts
import * as crypto from 'crypto'

const MASTER_KEY_ENV = 'FISCAL_CERT_KEY'
const ALGORITHM = 'aes-256-gcm'

function getMasterKey(): Buffer {
  const keyHex = process.env[MASTER_KEY_ENV]
  if (!keyHex || keyHex.length !== 64) {
    throw new Error(`${MASTER_KEY_ENV} must be 32 bytes (64 hex chars)`)
  }
  return Buffer.from(keyHex, 'hex')
}

export function encryptWithEnvelope(plaintext: string): {
  encryptedData: string
  encryptedDataKey: string
} {
  const masterKey = getMasterKey()

  // Generate random data key for this certificate
  const dataKey = crypto.randomBytes(32)
  const dataIv = crypto.randomBytes(12)

  // Encrypt plaintext with data key
  const dataCipher = crypto.createCipheriv(ALGORITHM, dataKey, dataIv)
  const encryptedContent = Buffer.concat([
    dataCipher.update(plaintext, 'utf8'),
    dataCipher.final()
  ])
  const dataTag = dataCipher.getAuthTag()

  // Encrypt data key with master key
  const keyIv = crypto.randomBytes(12)
  const keyCipher = crypto.createCipheriv(ALGORITHM, masterKey, keyIv)
  const encryptedKey = Buffer.concat([
    keyCipher.update(dataKey),
    keyCipher.final()
  ])
  const keyTag = keyCipher.getAuthTag()

  return {
    encryptedData: [
      dataIv.toString('hex'),
      encryptedContent.toString('hex'),
      dataTag.toString('hex')
    ].join(':'),
    encryptedDataKey: [
      keyIv.toString('hex'),
      encryptedKey.toString('hex'),
      keyTag.toString('hex')
    ].join(':')
  }
}

export function decryptWithEnvelope(
  encryptedData: string,
  encryptedDataKey: string
): string {
  const masterKey = getMasterKey()

  // Decrypt data key
  const [keyIvHex, encKeyHex, keyTagHex] = encryptedDataKey.split(':')
  const keyDecipher = crypto.createDecipheriv(
    ALGORITHM,
    masterKey,
    Buffer.from(keyIvHex, 'hex')
  )
  keyDecipher.setAuthTag(Buffer.from(keyTagHex, 'hex'))
  const dataKey = Buffer.concat([
    keyDecipher.update(Buffer.from(encKeyHex, 'hex')),
    keyDecipher.final()
  ])

  // Decrypt content
  const [dataIvHex, encContentHex, dataTagHex] = encryptedData.split(':')
  const dataDecipher = crypto.createDecipheriv(
    ALGORITHM,
    dataKey,
    Buffer.from(dataIvHex, 'hex')
  )
  dataDecipher.setAuthTag(Buffer.from(dataTagHex, 'hex'))
  return Buffer.concat([
    dataDecipher.update(Buffer.from(encContentHex, 'hex')),
    dataDecipher.final()
  ]).toString('utf8')
}
