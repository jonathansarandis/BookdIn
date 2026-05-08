'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { ChevronDown, ChevronUp, Copy, Check, Loader2, CheckCircle2, X } from 'lucide-react'
import {
  DEFAULT_BOOKING_CONFIRMATION,
  AVAILABLE_VARIABLES,
  type BookingConfirmationSections,
} from '@/lib/email/defaultTemplates'

const SECTION_DEFS: { key: keyof BookingConfirmationSections; label: string; rows: number }[] = [
  { key: 'greeting',              label: 'Greeting',                    rows: 4 },
  { key: 'extras_note_heading',   label: 'Extras note heading',         rows: 1 },
  { key: 'extras_note_body',      label: 'Extras note body',            rows: 4 },
  { key: 'payment_heading',       label: 'Payment section heading',     rows: 1 },
  { key: 'payment_body',          label: 'Payment section body',        rows: 3 },
  { key: 'payment_disclosure',    label: 'Pre-auth disclosure',         rows: 3 },
  { key: 'cancellation_heading',  label: 'Cancellation policy heading', rows: 1 },
  { key: 'cancellation_body',     label: 'Cancellation policy body',    rows: 4 },
  { key: 'walkthrough_heading',   label: 'Walkthrough heading',         rows: 1 },
  { key: 'walkthrough_body',      label: 'Walkthrough body',            rows: 5 },
  { key: 'sign_off',              label: 'Sign-off',                    rows: 2 },
]

export default function EmailTemplateCard({ businessId }: { businessId?: string }) {
  const [expanded, setExpanded] = useState(false)
  const [sections, setSections] = useState<BookingConfirmationSections>({ ...DEFAULT_BOOKING_CONFIRMATION })
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [copiedKey, setCopiedKey] = useState<string | null>(null)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [previewHtml, setPreviewHtml] = useState<string | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    if (!businessId || !expanded) return
    setLoading(true)
    supabase
      .from('email_templates')
      .select('sections')
      .eq('business_id', businessId)
      .eq('template_type', 'booking_confirmation')
      .single()
      .then(({ data }) => {
        if (data?.sections) {
          setSections({ ...DEFAULT_BOOKING_CONFIRMATION, ...(data.sections as Partial<BookingConfirmationSections>) })
        }
        setLoading(false)
      })
  }, [businessId, expanded])

  async function handleSave() {
    if (!businessId) return
    setSaving(true)
    setSaveError(null)
    const { error } = await supabase
      .from('email_templates')
      .upsert(
        { business_id: businessId, template_type: 'booking_confirmation', sections },
        { onConflict: 'business_id,template_type' }
      )
    setSaving(false)
    if (error) {
      setSaveError(error.message)
    } else {
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    }
  }

  async function handlePreview() {
    setPreviewLoading(true)
    setPreviewOpen(true)
    try {
      const res = await fetch('/api/settings/email-template/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sections }),
      })
      const data = await res.json()
      setPreviewHtml(data.html ?? '<p>Preview failed.</p>')
    } catch {
      setPreviewHtml('<p>Preview failed. Please try again.</p>')
    } finally {
      setPreviewLoading(false)
    }
  }

  function copyVariable(key: string) {
    navigator.clipboard.writeText(`{{${key}}}`)
    setCopiedKey(key)
    setTimeout(() => setCopiedKey(null), 2000)
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-gray-900">Email templates</h3>
        <p className="text-xs text-gray-500 mt-0.5">
          Customize the emails BookdIn sends to your customers. Use{' '}
          <code className="text-xs bg-gray-100 px-1 py-0.5 rounded font-mono">{`{{variable}}`}</code>{' '}
          to insert dynamic content from each booking.
        </p>
      </div>

      <div className="border border-gray-200 rounded-lg overflow-hidden">
        <button
          onClick={() => setExpanded(e => !e)}
          className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-gray-900 hover:bg-gray-50 transition-colors"
        >
          <span>Booking confirmation</span>
          {expanded
            ? <ChevronUp className="w-4 h-4 text-gray-400" />
            : <ChevronDown className="w-4 h-4 text-gray-400" />
          }
        </button>

        {expanded && (
          <div className="border-t border-gray-200 p-4 space-y-5">
            {loading ? (
              <div className="flex items-center justify-center gap-2 py-8 text-sm text-gray-400">
                <Loader2 className="w-4 h-4 animate-spin" />
                Loading template…
              </div>
            ) : (
              <>
                {/* Variable reference panel */}
                <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Available variables — click to copy</p>
                  <div className="grid grid-cols-2 gap-1.5">
                    {AVAILABLE_VARIABLES.map(v => (
                      <button
                        key={v.key}
                        onClick={() => copyVariable(v.key)}
                        title={`Example: ${v.example}`}
                        className="flex items-center justify-between px-2.5 py-2 bg-white border border-gray-200 rounded-lg text-left hover:border-gray-300 transition-colors group"
                      >
                        <div className="min-w-0">
                          <code className="text-xs text-brand-700 font-mono block truncate">{`{{${v.key}}}`}</code>
                          <p className="text-[11px] text-gray-400 truncate">{v.label}</p>
                        </div>
                        {copiedKey === v.key
                          ? <Check className="w-3 h-3 text-green-600 flex-shrink-0 ml-1" />
                          : <Copy className="w-3 h-3 text-gray-300 group-hover:text-gray-500 flex-shrink-0 ml-1 transition-colors" />
                        }
                      </button>
                    ))}
                  </div>
                </div>

                {/* Section editors */}
                <div className="space-y-4">
                  {SECTION_DEFS.map(({ key, label, rows }) => (
                    <div key={key}>
                      <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
                      <textarea
                        rows={rows}
                        value={sections[key]}
                        onChange={e => setSections(s => ({ ...s, [key]: e.target.value }))}
                        className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-500 resize-y font-mono leading-relaxed"
                      />
                    </div>
                  ))}
                </div>

                {saveError && <p className="text-xs text-red-600">{saveError}</p>}

                <div className="flex items-center gap-3 pt-1">
                  <button
                    onClick={handleSave}
                    disabled={saving || !businessId}
                    className="flex items-center gap-2 px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
                  >
                    {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    {saving ? 'Saving…' : 'Save template'}
                  </button>
                  <button
                    onClick={handlePreview}
                    disabled={previewLoading}
                    className="flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
                  >
                    {previewLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    Preview
                  </button>
                  {saved && (
                    <span className="flex items-center gap-1 text-xs text-green-600">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Saved
                    </span>
                  )}
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Preview modal */}
      {previewOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center p-4 overflow-y-auto bg-black/40">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl my-6 overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
              <h3 className="font-semibold text-gray-900 text-sm">Email preview — Booking confirmation</h3>
              <button
                onClick={() => { setPreviewOpen(false); setPreviewHtml(null) }}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 bg-gray-50">
              {previewLoading ? (
                <div className="flex items-center justify-center gap-2 py-16 text-gray-400">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Rendering preview…
                </div>
              ) : (
                <iframe
                  srcDoc={previewHtml ?? ''}
                  className="w-full bg-white rounded-lg border border-gray-200"
                  style={{ height: '640px' }}
                  title="Email preview"
                  sandbox="allow-same-origin"
                />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
