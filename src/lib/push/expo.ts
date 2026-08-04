// Thin wrapper around Expo's push HTTP API — no expo-server-sdk dependency
// needed, this is just a POST. Best-effort: callers treat push as
// non-critical, same as the existing email/SMS side effects.
interface ExpoPushMessage {
  to: string
  title: string
  body: string
  data?: Record<string, unknown>
}

export async function sendExpoPush(messages: ExpoPushMessage[]) {
  if (!messages.length) return
  try {
    const res = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'Accept-Encoding': 'gzip, deflate',
      },
      body: JSON.stringify(messages),
    })
    if (!res.ok) {
      console.error('[push] Expo push send failed:', res.status, await res.text())
    }
  } catch (e: any) {
    console.error('[push] Expo push send threw:', e.message)
  }
}
