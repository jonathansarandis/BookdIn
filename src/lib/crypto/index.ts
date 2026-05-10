import { randomBytes, createCipheriv, createDecipheriv } from 'node:crypto'

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 12  // GCM standard
const AUTH_TAG_LENGTH = 16

function getKey(): Buffer {
  const keyBase64 = process.env.SMS_ENCRYPTION_KEY
  if (!keyBase64) {
    throw new Error('SMS_ENCRYPTION_KEY is not set in environment')
  }
  const key = Buffer.from(keyBase64, 'base64')
  if (key.length !== 32) {
    throw new Error(`SMS_ENCRYPTION_KEY must decode to 32 bytes, got ${key.length}`)
  }
  return key
}

export interface EncryptedValue {
  ciphertext: string  // base64 (encrypted data + auth tag appended)
  iv: string          // base64
}

export function encrypt(plaintext: string): EncryptedValue {
  const key = getKey()
  const iv = randomBytes(IV_LENGTH)
  const cipher = createCipheriv(ALGORITHM, key, iv)
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const authTag = cipher.getAuthTag()
  // Append auth tag to ciphertext for storage convenience
  const combined = Buffer.concat([encrypted, authTag])
  return {
    ciphertext: combined.toString('base64'),
    iv: iv.toString('base64'),
  }
}

export function decrypt(ciphertext: string, iv: string): string {
  const key = getKey()
  const ivBuffer = Buffer.from(iv, 'base64')
  const combined = Buffer.from(ciphertext, 'base64')
  if (combined.length < AUTH_TAG_LENGTH) {
    throw new Error('Ciphertext too short to contain auth tag')
  }
  // Split: last 16 bytes are auth tag, rest is encrypted data
  const encrypted = combined.subarray(0, combined.length - AUTH_TAG_LENGTH)
  const authTag = combined.subarray(combined.length - AUTH_TAG_LENGTH)
  const decipher = createDecipheriv(ALGORITHM, key, ivBuffer)
  decipher.setAuthTag(authTag)
  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()])
  return decrypted.toString('utf8')
}
