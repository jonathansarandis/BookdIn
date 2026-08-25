// @ts-nocheck
export const metadata = {
  title: 'Terms of Service — BookdIn',
  description: 'The terms that govern use of BookdIn.',
}

export default function TermsOfServicePage() {
  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-3xl mx-auto px-6 py-16">
        <a href="/" className="text-sm font-semibold text-brand-600">BookdIn</a>
        <h1 className="text-3xl font-bold text-gray-900 mt-6 mb-2">Terms of Service</h1>
        <p className="text-sm text-gray-500 mb-10">Last updated: 25 August 2026</p>

        <div className="prose prose-gray max-w-none space-y-8 text-gray-700 leading-relaxed">
          <p>
            These Terms of Service ("Terms") govern access to and use of BookdIn, a booking,
            scheduling, CRM, payments, and AI-assisted operations platform for service businesses.
            By creating an account or using BookdIn, you agree to these Terms.
          </p>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">1. The service</h2>
            <p>
              BookdIn provides tools for managing bookings, scheduling, customer records, payments,
              and optional AI features including an AI office assistant and an AI voice receptionist
              that can answer calls, quote prices, check availability, and book jobs on a Business's
              behalf. Some features rely on third-party providers (payments, telephony, AI models,
              and, where connected, Google Ads) and are subject to those providers' own availability.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">2. Accounts</h2>
            <p>
              You're responsible for the accuracy of information you provide, for keeping your login
              credentials secure, and for activity that happens under your account. You must be
              authorized to act on behalf of the business you register.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">3. Acceptable use</h2>
            <p>
              You agree not to use BookdIn to send unlawful, deceptive, or abusive communications, to
              misrepresent your business to customers, to attempt to disrupt or reverse-engineer the
              service, or to use the AI voice or office assistant to impersonate a person in a way
              intended to deceive.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">4. AI features</h2>
            <p>
              BookdIn's AI office assistant and AI voice agent generate responses using third-party
              AI models and can make mistakes — including misunderstanding a request, mis-quoting a
              price, or mis-booking a detail. You're responsible for reviewing bookings, quotes, and
              messages the AI produces before relying on them for anything business-critical, and for
              configuring the AI features (pricing, availability, policies) accurately. Where the
              voice agent is enabled, calls may be recorded and transcribed; you're responsible for
              complying with applicable call-recording notice/consent laws in your jurisdiction.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">5. Payments</h2>
            <p>
              Payments processed through BookdIn are handled by Stripe. Fees, subscription charges,
              and payout timing are as described at checkout or in your account settings, and may
              change with notice.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">6. Third-party connections</h2>
            <p>
              If you connect a third-party account (such as Google Ads), you authorize BookdIn to
              access data from that account as described in our{' '}
              <a href="/privacy" className="text-brand-600 underline">Privacy Policy</a>, solely to
              provide the connected feature back to you. You can disconnect a third-party account at
              any time.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">7. Availability and changes</h2>
            <p>
              We aim to keep BookdIn reliable but don't guarantee uninterrupted availability. We may
              update, add, or remove features over time, and will make reasonable efforts to notify
              you of material changes.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">8. Limitation of liability</h2>
            <p>
              To the extent permitted by law, BookdIn is provided "as is," and we aren't liable for
              indirect or consequential losses arising from use of the service, including losses
              arising from AI-generated content or third-party service outages.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">9. Termination</h2>
            <p>
              You may stop using BookdIn at any time. We may suspend or terminate accounts that
              violate these Terms or applicable law.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">10. Contact us</h2>
            <p>
              Questions about these Terms can be sent to{' '}
              <a href="mailto:jonathan.sarandis@gmail.com" className="text-brand-600 underline">jonathan.sarandis@gmail.com</a>.
            </p>
          </section>
        </div>
      </div>
    </div>
  )
}
