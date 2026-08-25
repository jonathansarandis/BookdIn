// @ts-nocheck
export const metadata = {
  title: 'Privacy Policy — BookdIn',
  description: 'How BookdIn collects, uses, and protects data for businesses and their customers.',
}

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-3xl mx-auto px-6 py-16">
        <a href="/" className="text-sm font-semibold text-brand-600">BookdIn</a>
        <h1 className="text-3xl font-bold text-gray-900 mt-6 mb-2">Privacy Policy</h1>
        <p className="text-sm text-gray-500 mb-10">Last updated: 25 August 2026</p>

        <div className="prose prose-gray max-w-none space-y-8 text-gray-700 leading-relaxed">
          <p>
            BookdIn ("BookdIn," "we," "us," or "our") provides booking, scheduling, CRM, payments,
            and AI-assisted operations tools (including an AI office assistant and an AI voice
            receptionist) to service businesses ("Business," "you," when referring to our direct
            customer) and, through them, to their end customers ("Customers"). This policy explains
            what data we collect, why, and how it's handled.
          </p>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">1. Who this applies to</h2>
            <p>
              This policy covers two groups: businesses that sign up for a BookdIn account to run
              their operations, and the customers of those businesses who interact with a Business
              through BookdIn — for example by booking a service online or calling a phone number
              answered by a BookdIn voice agent.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">2. Information we collect</h2>
            <p><strong>From Businesses:</strong> account and contact details (name, email, phone),
            business details (name, address, services, pricing), team member information, and any
            third-party account connections you choose to authorize (for example Google Ads, Stripe,
            or a phone/SIP provider).</p>
            <p><strong>From Customers, via a Business's use of BookdIn:</strong> name, contact details,
            service address, booking history, payment information (processed by Stripe — BookdIn does
            not store full card numbers), and, if a Business enables the AI voice agent, call audio,
            transcripts, and call metadata (phone number, duration, outcome).</p>
            <p><strong>Automatically:</strong> standard technical data such as device/browser
            information and usage logs, used for security, debugging, and improving the product.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">3. How we use information</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>Operating core features: bookings, scheduling, invoicing, payments, and customer records.</li>
              <li>Powering the AI office assistant, which summarizes a Business's own operational data (jobs, payments, leads) to surface daily priorities.</li>
              <li>Powering the AI voice agent (where enabled), which answers calls, books jobs, and takes messages on a Business's behalf, and may record and transcribe calls for quality, training, and record-keeping purposes.</li>
              <li>If a Business connects a Google Ads account, reading campaign performance data (spend, conversions, cost-per-acquisition) to include in that Business's own reporting. We only request read access to advertising performance data — we do not modify campaigns.</li>
              <li>Sending transactional communications (booking confirmations, reminders, receipts) via email and SMS.</li>
              <li>Processing payments through Stripe, our payment processor.</li>
              <li>Maintaining the security, integrity, and reliability of the service.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">4. Third-party service providers</h2>
            <p>
              We rely on trusted subprocessors to operate BookdIn, including: Supabase (database and
              authentication), Stripe (payments), Vapi and its underlying speech/AI providers —
              currently Deepgram (speech-to-text), ElevenLabs and/or OpenAI (voice), and Anthropic
              and/or OpenAI (conversation intelligence) — for the voice agent, Anthropic (AI office
              assistant), and Google (for businesses that connect Google Ads). Each handles data
              only as needed to provide their respective service to us, under their own security and
              privacy commitments.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">5. Google user data</h2>
            <p>
              Where a Business connects a Google Ads account, BookdIn's use and transfer of
              information received from Google APIs adheres to the{' '}
              <a href="https://developers.google.com/terms/api-services-user-data-policy" className="text-brand-600 underline" target="_blank" rel="noreferrer">
                Google API Services User Data Policy
              </a>, including the Limited Use requirements. We request read-only access to
              advertising performance data for the sole purpose of displaying it back to the
              connected Business, and we do not use this data for advertising or sell it to third
              parties. A Business can disconnect this access at any time from BookdIn's Settings, or
              directly from their{' '}
              <a href="https://myaccount.google.com/permissions" className="text-brand-600 underline" target="_blank" rel="noreferrer">
                Google Account permissions
              </a> page.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">6. Data retention</h2>
            <p>
              We retain data for as long as a Business's account is active, and for a reasonable
              period afterward to meet legal, accounting, or dispute-resolution obligations. Call
              recordings and transcripts are retained to support quality review and record-keeping,
              and can be deleted on request.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">7. Your rights</h2>
            <p>
              Depending on where you're located, you may have rights to access, correct, export, or
              delete your personal information. Businesses can manage most Customer data directly
              within BookdIn. To make a request regarding your own data, contact us using the details
              below.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">8. Security</h2>
            <p>
              We use industry-standard safeguards — encryption in transit and at rest for sensitive
              fields, access controls, and least-privilege service credentials — to protect the data
              we hold. No system is completely secure, and we encourage Businesses to use strong,
              unique passwords and enable available account protections.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">9. Changes to this policy</h2>
            <p>
              We may update this policy from time to time. Material changes will be reflected by
              updating the date at the top of this page.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">10. Contact us</h2>
            <p>
              Questions about this policy or your data can be sent to{' '}
              <a href="mailto:jonathan.sarandis@gmail.com" className="text-brand-600 underline">jonathan.sarandis@gmail.com</a>.
            </p>
          </section>
        </div>
      </div>
    </div>
  )
}
