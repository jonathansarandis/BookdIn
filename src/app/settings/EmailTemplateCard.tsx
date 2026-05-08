'use client'
import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { ChevronDown, ChevronUp, Copy, Check, Loader2, CheckCircle2, X, Bold, Italic, Link2 } from 'lucide-react'
import {
  DEFAULT_BOOKING_CONFIRMATION_BODY,
  AVAILABLE_VARIABLES,
  LAYOUT_BLOCKS,
} from '@/lib/email/defaultTemplates'

export default function EmailTemplateCard({ businessId }: { businessId?: string }) {
  const [expanded, setExpanded] = useState(false)
  const [body, setBody] = useState(DEFAULT_BOOKING_CONFIRMATION_BODY)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [copiedKey, setCopiedKey] = useState<string | null>(null)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [previewHtml, setPreviewHtml] = useState<string | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
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
        const sections = data?.sections as any
        if (typeof sections?.body === 'string') {
          setBody(sections.body)
        }
        // Old sectioned schema: leave default body — server will migrate on first send
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
        { business_id: businessId, template_type: 'booking_confirmation', sections: { body } },
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
        body: JSON.stringify({ body }),
      })
      const data = await res.json()
      setPreviewHtml(data.html ?? '<p>Preview failed.</p>')
    } catch {
      setPreviewHtml('<p>Preview failed. Please try again.</p>')
    } finally {
      setPreviewLoading(false)
    }
  }

  function insertAtCursor(text: string) {
    navigator.clipboard.writeText(text)
    setCopiedKey(text.replace(/\{|\}/g, ''))
    setTimeout(() => setCopiedKey(null), 2000)
  }

  function wrapSelection(before: string, after: string) {
    const ta = textareaRef.current
    if (!ta) return
    const start = ta.selectionStart
    const end = ta.selectionEnd
    const selected = body.slice(start, end)
    const next = body.slice(0, start) + before + selected + after + body.slice(end)
    setBody(next)
    requestAnimationFrame(() => {
      ta.focus()
      ta.setSelectionRange(start + before.length, end + before.length)
    })
  }

  function handleLink() {
    const ta = textareaRef.current
    if (!ta) return
    const start = ta.selectionStart
    const end = ta.selectionEnd
    const selected = body.slice(start, end) || 'link text'
    const url = window.prompt('Enter URL:', 'https://')
    if (!url) return
    const replacement = `[${selected}](${url})`
    const next = body.slice(0, start) + replacement + body.slice(end)
    setBody(next)
    requestAnimationFrame(() => {
      ta.focus()
      ta.setSelectionRange(start, start + replacement.length)
    })
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-gray-900">Email templates</h3>
        <p className="text-xs text-gray-500 mt-0.5">
          Customize the emails BookdIn sends to your customers. Use{' '}
          <code className="text-xs bg-gray-100 px-1 py-0.5 rounded font-mono">{`{{variable}}`}</code>{' '}
          to insert dynamic content, and <strong className="font-semibold">**bold**</strong>, <em>*italic*</em>, or{' '}
          <code className="text-xs bg-gray-100 px-1 py-0.5 rounded font-mono">[text](url)</code> for light formatting.
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
          <div className="border-t border-gray-200 p-4 space-y-4">
            {loading ? (
              <div className="flex items-center justify-center gap-2 py-8 text-sm text-gray-400">
                <Loader2 className="w-4 h-4 animate-spin" />
                Loading template…
              </div>
            ) : (
              <>
                {/* Variable reference panel */}
                <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                  <div>
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Variables — click to copy</p>
                    <div className="grid grid-cols-2 gap-1.5">
                      {AVAILABLE_VARIABLES.map(v => (
                        <button
                          key={v.key}
                          onClick={() => insertAtCursor(`{{${v.key}}}`)}
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

                  <div>
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Layout blocks — click to copy</p>
                    <div className="grid grid-cols-2 gap-1.5">
                      {LAYOUT_BLOCKS.map(b => (
                        <button
                          key={b.key}
                          onClick={() => insertAtCursor(`{{${b.key}}}`)}
                          title={b.description}
                          className="flex items-center justify-between px-2.5 py-2 bg-white border border-indigo-200 rounded-lg text-left hover:border-indigo-300 transition-colors group"
                        >
                          <div className="min-w-0">
                            <code className="text-xs text-indigo-700 font-mono block truncate">{`{{${b.key}}}`}</code>
                            <p className="text-[11px] text-gray-400 truncate">{b.label}</p>
                          </div>
                          {copiedKey === b.key
                            ? <Check className="w-3 h-3 text-green-600 flex-shrink-0 ml-1" />
                            : <Copy className="w-3 h-3 text-gray-300 group-hover:text-indigo-400 flex-shrink-0 ml-1 transition-colors" />
                          }
                        </button>
                      ))}
                    </div>
                    <p className="text-[11px] text-gray-400 mt-2">
                      Place these on their own line with a blank line above and below. Auto-inserted if missing.
                    </p>
                  </div>
                </div>

                {/* Markdown toolbar */}
                <div className="flex items-center gap-1 border border-gray-200 rounded-t-lg px-2 py-1.5 bg-gray-50 border-b-0">
                  <button
                    type="button"
                    onClick={() => wrapSelection('**', '**')}
                    title="Bold"
                    className="px-2.5 py-1 text-sm font-bold text-gray-600 hover:bg-white hover:text-gray-900 rounded transition-colors"
                  >
                    B
                  </button>
                  <button
                    type="button"
                    onClick={() => wrapSelection('*', '*')}
                    title="Italic"
                    className="px-2.5 py-1 text-sm italic text-gray-600 hover:bg-white hover:text-gray-900 rounded transition-colors"
                  >
                    I
                  </button>
                  <button
                    type="button"
                    onClick={handleLink}
                    title="Insert link"
                    className="flex items-center gap-1 px-2.5 py-1 text-xs text-gray-600 hover:bg-white hover:text-gray-900 rounded transition-colors"
                  >
                    <Link2 className="w-3.5 h-3.5" />
                    Link
                  </button>
                </div>

                {/* Single body editor */}
                <textarea
                  ref={textareaRef}
                  value={body}
                  onChange={e => setBody(e.target.value)}
                  className="w-full text-sm border border-gray-200 rounded-b-lg px-3 py-3 text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-500 resize-y font-mono leading-relaxed"
                  style={{ minHeight: '400px' }}
                  spellCheck
                />

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
