import { NextResponse } from 'next/server'
import { createHash } from 'node:crypto'

export const dynamic = 'force-dynamic'

export async function GET() {
  const key = process.env.SMS_ENCRYPTION_KEY
  if (!key) return NextResponse.json({ error: 'SMS_ENCRYPTION_KEY not set' }, { status: 500 })
  const hash = createHash('sha256').update(key).digest('hex')
  const decodedLength = Buffer.from(key, 'base64').length
  return NextResponse.json({
    key_sha256: hash,
    raw_length: key.length,
    decoded_length: decodedLength,
  })
}
