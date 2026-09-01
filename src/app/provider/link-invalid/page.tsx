// @ts-nocheck
// Shown when a provider's portal link doesn't resolve to anything — the
// token was regenerated/revoked, mistyped, or (for anyone still on the old
// password-based flow) their session expired. There's deliberately no login
// form here: the whole point of the portal_token flow is that a subcontractor
// never has to remember a password — the fix is always "ask your manager to
// resend your link", not "try to sign in again".
export default function ProviderLinkInvalidPage() {
  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: '#0A0F1E' }}>
      <div className="w-full max-w-sm px-6">
        <div className="text-center mb-8">
          <div style={{ fontFamily: "'NeueKabel', 'Arial Black', sans-serif", fontWeight: 900, fontSize: '32px', color: '#F0F2FF', letterSpacing: '-1px' }}>
            Bookd<span style={{ color: '#2563FF' }}>In</span>
          </div>
          <p style={{ color: 'rgba(200,212,240,0.5)', fontSize: '14px', marginTop: '8px' }}>Provider Portal</p>
        </div>

        <div style={{ background: '#111827', border: '1px solid rgba(37,99,255,0.2)', borderRadius: '16px', padding: '32px' }} className="text-center">
          <h1 style={{ color: '#F0F2FF', fontSize: '18px', fontWeight: 700, marginBottom: '10px' }}>This link isn't working</h1>
          <p style={{ color: 'rgba(200,212,240,0.6)', fontSize: '14px', lineHeight: 1.6 }}>
            Ask your manager to resend your portal link — it's the same one you
            usually use, no need to sign in with a password.
          </p>
        </div>

        <p style={{ textAlign: 'center', color: 'rgba(200,212,240,0.3)', fontSize: '12px', marginTop: '24px' }}>
          Powered by BookdIn
        </p>
      </div>
    </div>
  )
}
