import { normalizeAuPhone } from './phone'

const cases: Array<[string, string | null]> = [
  ['0421240111', '+61421240111'],
  ['0421 240 111', '+61421240111'],
  ['+61421240111', '+61421240111'],
  ['61421240111', '+61421240111'],
  ['421240111', '+61421240111'],
  ['(02) 9876 5432', '+61298765432'],
  ['', null],
  ['12345', null],
  ['+1234567890', null],
  ['  0421240111  ', '+61421240111'],
]

let passed = 0
let failed = 0
for (const [input, expected] of cases) {
  const actual = normalizeAuPhone(input)
  if (actual === expected) {
    passed++
    console.log(`✅ "${input}" -> ${actual}`)
  } else {
    failed++
    console.error(`❌ "${input}" -> got ${actual}, expected ${expected}`)
  }
}
console.log(`\n${passed} passed, ${failed} failed`)
process.exit(failed > 0 ? 1 : 0)
