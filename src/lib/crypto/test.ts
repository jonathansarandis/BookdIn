import { encrypt, decrypt } from './index'

let passed = 0
let failed = 0

function assert(cond: boolean, msg: string) {
  if (cond) { passed++; console.log(`✅ ${msg}`) }
  else { failed++; console.error(`❌ ${msg}`) }
}

// Test 1: round-trip
const plaintext = 'sk_test_dialpad_api_key_xyz123'
const { ciphertext, iv } = encrypt(plaintext)
const decrypted = decrypt(ciphertext, iv)
assert(decrypted === plaintext, 'round-trip: encrypt then decrypt returns original')

// Test 2: different IVs produce different ciphertexts
const a = encrypt(plaintext)
const b = encrypt(plaintext)
assert(a.ciphertext !== b.ciphertext, 'same plaintext produces different ciphertexts (random IV)')
assert(a.iv !== b.iv, 'IVs are different across calls')

// Test 3: tampered ciphertext throws
let threw = false
try {
  // Flip a byte in the ciphertext (decode, mutate, re-encode)
  const tamperedBuffer = Buffer.from(a.ciphertext, 'base64')
  tamperedBuffer[0] = tamperedBuffer[0] ^ 0xff  // flip first byte
  decrypt(tamperedBuffer.toString('base64'), a.iv)
} catch {
  threw = true
}
assert(threw, 'tampered ciphertext throws on decrypt (auth tag verification)')

// Test 4: wrong IV throws
threw = false
try {
  const wrongIv = Buffer.alloc(12).toString('base64')
  decrypt(a.ciphertext, wrongIv)
} catch {
  threw = true
}
assert(threw, 'wrong IV throws on decrypt')

console.log(`\n${passed} passed, ${failed} failed`)
process.exit(failed > 0 ? 1 : 0)
