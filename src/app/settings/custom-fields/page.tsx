// @ts-nocheck
'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Sidebar from '@/components/layout/Sidebar'
import Topbar from '@/components/layout/Topbar'
import {
  DndContext,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  GripVertical, Plus, Pencil, Trash2, Loader2, X, AlertCircle, CheckCircle2,
} from 'lucide-react'

const FIELD_TYPES = [
  { value: 'text',     label: 'Short text' },
  { value: 'textarea', label: 'Long text' },
  { value: 'number',   label: 'Number' },
  { value: 'select',   label: 'Dropdown' },
  { value: 'radio',    label: 'Radio buttons' },
  { value: 'checkbox', label: 'Checkbox' },
]

const TYPE_BADGE: Record<string, string> = {
  text:     'bg-blue-50 text-blue-700',
  textarea: 'bg-purple-50 text-purple-700',
  number:   'bg-amber-50 text-amber-700',
  select:   'bg-green-50 text-green-700',
  radio:    'bg-pink-50 text-pink-700',
  checkbox: 'bg-gray-100 text-gray-700',
}

const inputCls = 'w-full text-sm border border-gray-200 rounded-lg px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-500'
const labelCls = 'block text-xs font-medium text-gray-600 mb-1'

interface CustomField {
  id: string
  label: string
  field_type: string
  options: { label: string; value: string }[]
  required: boolean
  sort_order: number
  is_active: boolean
}

interface FieldModalProps {
  initial: Partial<CustomField> | null
  onClose: () => void
  onSave: (data: Omit<CustomField, 'id' | 'sort_order' | 'is_active'>) => Promise<void>
}

function FieldModal({ initial, onClose, onSave }: FieldModalProps) {
  const [label, setLabel] = useState(initial?.label ?? '')
  const [fieldType, setFieldType] = useState(initial?.field_type ?? 'text')
  const [options, setOptions] = useState<{ label: string; value: string }[]>(
    initial?.options?.length ? initial.options : [{ label: '', value: '' }]
  )
  const [required, setRequired] = useState(initial?.required ?? false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const needsOptions = fieldType === 'select' || fieldType === 'radio'

  function addOption() {
    setOptions(o => [...o, { label: '', value: '' }])
  }

  function removeOption(i: number) {
    setOptions(o => o.filter((_, idx) => idx !== i))
  }

  function updateOption(i: number, key: 'label' | 'value', val: string) {
    setOptions(o => o.map((opt, idx) => idx === i ? { ...opt, [key]: val } : opt))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!label.trim()) { setError('Label is required'); return }
    if (needsOptions && options.filter(o => o.label.trim()).length === 0) {
      setError('Add at least one option'); return
    }
    setSaving(true)
    try {
      await onSave({
        label: label.trim(),
        field_type: fieldType,
        options: needsOptions ? options.filter(o => o.label.trim()).map(o => ({
          label: o.label.trim(),
          value: o.value.trim() || o.label.trim().toLowerCase().replace(/\s+/g, '_'),
        })) : [],
        required,
      })
    } catch (e: any) {
      setError(e.message)
      setSaving(false)
    }
  }

  const previewLabel = label.trim() || null
  const realOptions = options.filter(o => o.label.trim())
  const disabledInputCls = 'w-full text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white text-gray-400 cursor-not-allowed'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.4)' }}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-900">
            {initial?.id ? 'Edit field' : 'Add field'}
          </h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-0 md:gap-0">
          {/* Left: form */}
          <form onSubmit={handleSubmit} className="p-5 space-y-4 md:border-r md:border-gray-100">
            <div>
              <label className={labelCls}>Label <span className="text-red-500">*</span></label>
              <input
                type="text"
                value={label}
                onChange={e => setLabel(e.target.value)}
                placeholder="e.g. Pet name, Access instructions"
                className={inputCls}
                autoFocus
              />
            </div>

            <div>
              <label className={labelCls}>Field type</label>
              <select value={fieldType} onChange={e => setFieldType(e.target.value)} className={inputCls}>
                {FIELD_TYPES.map(t => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>

            {needsOptions && (
              <div>
                <label className={labelCls}>Options <span className="text-red-500">*</span></label>
                <div className="space-y-2">
                  {options.map((opt, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <input
                        type="text"
                        value={opt.label}
                        onChange={e => updateOption(i, 'label', e.target.value)}
                        placeholder={`Option ${i + 1}`}
                        className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-500"
                      />
                      {options.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeOption(i)}
                          className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={addOption}
                    className="flex items-center gap-1.5 text-xs text-brand-600 hover:text-brand-700 font-medium mt-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Add option
                  </button>
                </div>
              </div>
            )}

            <div className="flex items-center justify-between py-1">
              <div>
                <p className="text-sm font-medium text-gray-900">Required</p>
                <p className="text-xs text-gray-500">Customers must fill this in before submitting</p>
              </div>
              <button
                type="button"
                onClick={() => setRequired(r => !r)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${required ? 'bg-brand-500' : 'bg-gray-200'}`}
              >
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${required ? 'translate-x-6' : 'translate-x-1'}`} />
              </button>
            </div>

            {error && (
              <div className="flex items-center gap-2 text-xs text-red-600 bg-red-50 px-3 py-2 rounded-lg">
                <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                {error}
              </div>
            )}

            <div className="flex items-center gap-3 pt-1">
              <button
                type="submit"
                disabled={saving}
                className="flex items-center gap-2 px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
              >
                {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                {saving ? 'Saving…' : 'Save field'}
              </button>
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>

          {/* Right: Preview */}
          <div className="p-5">
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-4">Preview</p>
            <div className="bg-gray-50 rounded-xl p-5">
              {fieldType === 'checkbox' ? (
                <label className="flex items-center gap-2 cursor-not-allowed">
                  <input type="checkbox" disabled className="w-4 h-4 rounded border-gray-300 text-brand-500 cursor-not-allowed" />
                  <span className="text-sm text-gray-700">
                    {previewLabel
                      ? <>{previewLabel}{required && <span className="text-red-500 ml-0.5">*</span>}</>
                      : <em className="text-gray-400">Field label</em>
                    }
                  </span>
                </label>
              ) : (
                <>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {previewLabel
                      ? <>{previewLabel}{required && <span className="text-red-500 ml-0.5">*</span>}</>
                      : <em className="text-gray-400 font-normal">Field label</em>
                    }
                  </label>

                  {fieldType === 'text' && (
                    <input type="text" disabled placeholder="Your answer" className={disabledInputCls} />
                  )}

                  {fieldType === 'textarea' && (
                    <textarea disabled placeholder="Your answer" rows={3} className={disabledInputCls} />
                  )}

                  {fieldType === 'number' && (
                    <input type="number" disabled placeholder="0" className={disabledInputCls} />
                  )}

                  {fieldType === 'select' && (
                    realOptions.length > 0 ? (
                      <select disabled className={disabledInputCls}>
                        <option>Select an option…</option>
                        {realOptions.map((o, i) => (
                          <option key={i}>{o.label}</option>
                        ))}
                      </select>
                    ) : (
                      <p className="text-xs text-gray-400 italic mt-1">Add options on the left</p>
                    )
                  )}

                  {fieldType === 'radio' && (
                    realOptions.length > 0 ? (
                      <div className="space-y-2">
                        {realOptions.map((o, i) => (
                          <label key={i} className="flex items-center gap-2 cursor-not-allowed">
                            <input type="radio" disabled className="w-4 h-4 border-gray-300 text-brand-500 cursor-not-allowed" />
                            <span className="text-sm text-gray-700">{o.label}</span>
                          </label>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-gray-400 italic mt-1">Add options on the left</p>
                    )
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

interface SortableRowProps {
  field: CustomField
  onEdit: (f: CustomField) => void
  onDelete: (id: string) => void
}

function SortableRow({ field, onEdit, onDelete }: SortableRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: field.id })
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  const typeLabel = FIELD_TYPES.find(t => t.value === field.field_type)?.label ?? field.field_type
  const badgeCls = TYPE_BADGE[field.field_type] ?? 'bg-gray-100 text-gray-700'

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-3 px-4 py-3 bg-white border border-gray-200 rounded-xl hover:border-gray-300 transition-colors group"
    >
      <button
        {...attributes}
        {...listeners}
        className="flex-shrink-0 p-1 rounded text-gray-300 hover:text-gray-500 cursor-grab active:cursor-grabbing touch-none"
        title="Drag to reorder"
      >
        <GripVertical className="w-4 h-4" />
      </button>

      <span className="flex-1 text-sm font-medium text-gray-900 truncate">{field.label}</span>

      <span className={`flex-shrink-0 text-xs font-medium px-2 py-0.5 rounded-full ${badgeCls}`}>
        {typeLabel}
      </span>

      {field.required && (
        <span className="flex-shrink-0 text-red-500 font-bold text-base leading-none" title="Required">*</span>
      )}

      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={() => onEdit(field)}
          className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-colors"
          title="Edit"
        >
          <Pencil className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={() => onDelete(field.id)}
          className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors"
          title="Delete"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  )
}

export default function CustomFieldsPage() {
  const router = useRouter()
  const supabase = createClient()

  const [profile, setProfile] = useState<any>(null)
  const [business, setBusiness] = useState<any>(null)
  const [fields, setFields] = useState<CustomField[]>([])
  const [loading, setLoading] = useState(true)
  const [flash, setFlash] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [editingField, setEditingField] = useState<CustomField | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  useEffect(() => { load() }, [])

  async function load() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/auth/login'); return }

    const { data: prof } = await supabase
      .from('profiles')
      .select('*, businesses(*)')
      .eq('id', user.id)
      .single()

    const biz = Array.isArray(prof?.businesses) ? prof.businesses[0] : prof?.businesses
    setProfile(prof)
    setBusiness(biz)

    if (biz?.id) {
      const { data } = await supabase
        .from('custom_fields')
        .select('*')
        .eq('business_id', biz.id)
        .eq('is_active', true)
        .order('sort_order', { ascending: true })
      setFields(data ?? [])
    }
    setLoading(false)
  }

  function showFlash(type: 'success' | 'error', text: string) {
    setFlash({ type, text })
    setTimeout(() => setFlash(null), 3000)
  }

  async function handleSave(data: Omit<CustomField, 'id' | 'sort_order' | 'is_active'>) {
    if (!business) return

    if (editingField?.id) {
      const { error } = await supabase
        .from('custom_fields')
        .update({ ...data })
        .eq('id', editingField.id)
      if (error) throw new Error(error.message)
      setFields(f => f.map(x => x.id === editingField.id ? { ...x, ...data } : x))
      showFlash('success', 'Field updated')
    } else {
      const maxOrder = fields.length > 0 ? Math.max(...fields.map(f => f.sort_order)) : -1
      const { data: inserted, error } = await supabase
        .from('custom_fields')
        .insert({
          business_id: business.id,
          ...data,
          sort_order: maxOrder + 1,
          is_active: true,
        })
        .select()
        .single()
      if (error) throw new Error(error.message)
      setFields(f => [...f, inserted])
      showFlash('success', 'Field added')
    }

    setShowModal(false)
    setEditingField(null)
  }

  async function handleDelete(id: string) {
    if (!confirm('Remove this field? Existing booking responses will be preserved.')) return
    const { error } = await supabase
      .from('custom_fields')
      .update({ is_active: false })
      .eq('id', id)
    if (error) { showFlash('error', 'Failed to remove field'); return }
    setFields(f => f.filter(x => x.id !== id))
    showFlash('success', 'Field removed')
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const oldIndex = fields.findIndex(f => f.id === active.id)
    const newIndex = fields.findIndex(f => f.id === over.id)
    const reordered = arrayMove(fields, oldIndex, newIndex)
    setFields(reordered)

    await Promise.all(
      reordered.map((f, i) =>
        supabase.from('custom_fields').update({ sort_order: i }).eq('id', f.id)
      )
    )
  }

  function openAdd() { setEditingField(null); setShowModal(true) }
  function openEdit(f: CustomField) { setEditingField(f); setShowModal(true) }

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      <Sidebar profile={profile} business={business} />
      <div className="flex flex-col flex-1 overflow-hidden">
        <Topbar profile={profile} business={business} />
        <main className="flex-1 overflow-y-auto p-6">
          <div className="max-w-2xl mx-auto space-y-6 animate-fade-in">

            {/* Header */}
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Custom Fields</h2>
                <p className="text-sm text-gray-500 mt-0.5">
                  Add fields to your public booking form. Fields appear between the address and contact info steps.
                </p>
              </div>
              <button
                onClick={openAdd}
                className="flex items-center gap-2 px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium rounded-lg transition-colors"
              >
                <Plus className="w-4 h-4" />
                Add field
              </button>
            </div>

            {flash && (
              <div className={`flex items-center gap-2 px-4 py-3 rounded-lg text-sm ${
                flash.type === 'success'
                  ? 'bg-green-50 text-green-700 border border-green-200'
                  : 'bg-red-50 text-red-700 border border-red-200'
              }`}>
                {flash.type === 'success'
                  ? <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                  : <AlertCircle className="w-4 h-4 flex-shrink-0" />
                }
                {flash.text}
              </div>
            )}

            {loading ? (
              <div className="flex items-center gap-2 py-10 text-sm text-gray-400 justify-center">
                <Loader2 className="w-4 h-4 animate-spin" />
                Loading…
              </div>
            ) : fields.length === 0 ? (
              <div className="bg-white border border-gray-200 rounded-xl p-10 text-center">
                <div className="w-12 h-12 rounded-xl bg-gray-100 flex items-center justify-center mx-auto mb-4">
                  <Plus className="w-5 h-5 text-gray-400" />
                </div>
                <p className="text-sm font-medium text-gray-900 mb-1">No custom fields yet</p>
                <p className="text-sm text-gray-500 mb-6">
                  Add fields to collect extra information from customers when they book.
                </p>
                <button
                  onClick={openAdd}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium rounded-lg transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  Add your first field
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-xs text-gray-400 px-1">Drag rows to reorder</p>
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={handleDragEnd}
                >
                  <SortableContext items={fields.map(f => f.id)} strategy={verticalListSortingStrategy}>
                    {fields.map(field => (
                      <SortableRow
                        key={field.id}
                        field={field}
                        onEdit={openEdit}
                        onDelete={handleDelete}
                      />
                    ))}
                  </SortableContext>
                </DndContext>
              </div>
            )}
          </div>
        </main>
      </div>

      {showModal && (
        <FieldModal
          initial={editingField}
          onClose={() => { setShowModal(false); setEditingField(null) }}
          onSave={handleSave}
        />
      )}
    </div>
  )
}
