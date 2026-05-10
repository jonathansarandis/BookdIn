import { loadEnvConfig } from '@next/env'
import path from 'node:path'

// Load .env.local (the Next.js way; finds it in the project root)
loadEnvConfig(path.resolve(process.cwd()))

import { encrypt } from '../src/lib/crypto'

const plaintext = process.argv[2]

if (!plaintext) {
  console.error('Usage: npx tsx scripts/encrypt-sms-key.ts <plaintext_api_key>')
  process.exit(1)
}

const { ciphertext, iv } = encrypt(plaintext)

console.log('')
console.log('=== Encrypted ===')
console.log('ciphertext (base64):')
console.log(ciphertext)
console.log('')
console.log('iv (base64):')
console.log(iv)
console.log('')
console.log('=== Ready-to-paste SQL ===')
console.log('-- Replace BUSINESS_ID with the target business UUID')
console.log("UPDATE businesses SET")
console.log(`  sms_api_key_encrypted = '${ciphertext}',`)
console.log(`  sms_api_key_iv = '${iv}'`)
console.log("WHERE id = 'BUSINESS_ID';")
console.log('')
