// @ts-nocheck
'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Sidebar from '@/components/layout/Sidebar'
import Topbar from '@/components/layout/Topbar'
import {
  DndContext, DragOverlay, closestCenter,
  KeyboardSensor, PointerSensor, useSensor, useSensors,
  useDroppable,
} from '@dnd-kit/core'
import {
  SortableContext, sortableKeyboardCoordinates,
  useSortable, verticalListSortingStrategy, arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  AlertCircle, CheckCircle2, ChevronDown, GripVertical,
  LayoutGrid, Loader2, Plus, Trash2, X,
} from 'lucide-react'

// ─── Constants ────────────────────────────────────────────────────────────────

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

const BUILTIN_FIELD_LABELS: Record<string, string> = {
  service_picker:    'Service picker',
  room_counts:       'Bedrooms & bathrooms',
  extras_picker:     'Add-ons',
  frequency_picker:  'Frequency',
  date_time_picker:  'Date & time',
  address:           'Address',
  contact_info:      'Contact info',
  tnc_checkbox:      'Terms & Conditions',
}
const BUILTIN_KEYS = Object.keys(BUILTIN_FIELD_LABELS)

const inputCls = 'w-full text-sm border border-gray-200 rounded-lg px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-500'
const labelCls = 'block text-xs font-medium text-gray-600 mb-1'

// ─── Interfaces ───────────────────────────────────────────────────────────────

interface CustomField {
  id: string
  label: string
  field_type: string
  options: { label: string; value: string }[]
  required: boolean
  sort_order: number
  is_active: boolean
  default_value?: any
}

interface FormStep {
  id: string
  form_id: string
  sort_order: number
  next_button_label: string
}

interface FieldPlacement {
  id: string
  step_id: string
  field_key: string
  field_type: 'builtin' | 'custom'
  sort_order: number
}

interface BookingForm {
  id: string
  title: string
  subtitle: string
}

interface AppState {
  form: BookingForm
  steps: FormStep[]
  placements: FieldPlacement[]
  customFields: CustomField[]
}

function tmpId() {
  return `tmp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
}

function stateEqual(a: AppState, b: AppState) {
  return JSON.stringify(a) === JSON.stringify(b)
}

// ─── CustomFieldPreview ───────────────────────────────────────────────────────

function CustomFieldPreview({ field }: { field: CustomField }) {
  const dis = 'w-full text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white text-gray-400 cursor-not-allowed'
  const realOpts = (field.options || []).filter(o => o.label?.trim())

  if (field.field_type === 'checkbox') {
    return (
      <label className="flex items-center gap-2 cursor-not-allowed">
        <input type="checkbox" disabled className="w-4 h-4 rounded border-gray-300 cursor-not-allowed" />
        <span className="text-sm text-gray-700">
          {field.label}{field.required && <span className="text-red-500 ml-0.5">*</span>}
        </span>
      </label>
    )
  }

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-2">
        {field.label}{field.required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {field.field_type === 'text' && <input type="text" disabled placeholder="Your answer" className={dis} />}
      {field.field_type === 'textarea' && <textarea disabled placeholder="Your answer" rows={2} className={dis} />}
      {field.field_type === 'number' && <input type="number" disabled placeholder="0" className={dis} />}
      {field.field_type === 'select' && (
        realOpts.length > 0
          ? <select disabled className={dis}><option>Select an option…</option>{realOpts.map((o, i) => <option key={i}>{o.label}</option>)}</select>
          : <p className="text-xs text-gray-400 italic">No options yet</p>
      )}
      {field.field_type === 'radio' && (
        realOpts.length > 0
          ? <div className="space-y-1">{realOpts.map((o, i) => (
              <label key={i} className="flex items-center gap-2 cursor-not-allowed">
                <input type="radio" disabled className="w-4 h-4 border-gray-300 cursor-not-allowed" />
                <span className="text-sm text-gray-700">{o.label}</span>
              </label>
            ))}</div>
          : <p className="text-xs text-gray-400 italic">No options yet</p>
      )}
    </div>
  )
}

// ─── FieldModal ───────────────────────────────────────────────────────────────

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
  const [defaultValue, setDefaultValue] = useState<any>(initial?.default_value ?? null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const needsOptions = fieldType === 'select' || fieldType === 'radio'
  const previewLabel = label.trim() || null
  const realOptions = options.filter(o => o.label.trim())
  const disabledInputCls = 'w-full text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white text-gray-400 cursor-not-allowed'

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!label.trim()) { setError('Label is required'); return }
    if (needsOptions && options.filter(o => o.label.trim()).length === 0) { setError('Add at least one option'); return }
    setSaving(true)
    try {
      await onSave({
        label: label.trim(), field_type: fieldType, required,
        options: needsOptions ? options.filter(o => o.label.trim()).map(o => ({
          label: o.label.trim(),
          value: o.value.trim() || o.label.trim().toLowerCase().replace(/\s+/g, '_'),
        })) : [],
        default_value: defaultValue !== '' ? defaultValue : null,
      })
    } catch (e: any) { setError(e.message); setSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.4)' }}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-900">{initial?.id ? 'Edit field' : 'New custom field'}</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"><X className="w-4 h-4 text-gray-500" /></button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-0">
          <form onSubmit={handleSubmit} className="p-5 space-y-4 md:border-r md:border-gray-100">
            <div>
              <label className={labelCls}>Label <span className="text-red-500">*</span></label>
              <input type="text" value={label} onChange={e => setLabel(e.target.value)} placeholder="e.g. Pet name, Access instructions" className={inputCls} autoFocus />
            </div>
            <div>
              <label className={labelCls}>Field type</label>
              <select value={fieldType} onChange={e => setFieldType(e.target.value)} className={inputCls}>
                {FIELD_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            {needsOptions && (
              <div>
                <label className={labelCls}>Options <span className="text-red-500">*</span></label>
                <div className="space-y-2">
                  {options.map((opt, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <input type="text" value={opt.label} onChange={e => setOptions(o => o.map((x, j) => j === i ? { ...x, label: e.target.value } : x))}
                        placeholder={`Option ${i + 1}`} className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-500" />
                      {options.length > 1 && (
                        <button type="button" onClick={() => setOptions(o => o.filter((_, j) => j !== i))} className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors">
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  ))}
                  <button type="button" onClick={() => setOptions(o => [...o, { label: '', value: '' }])} className="flex items-center gap-1.5 text-xs text-brand-600 hover:text-brand-700 font-medium mt-1">
                    <Plus className="w-3.5 h-3.5" />Add option
                  </button>
                </div>
              </div>
            )}
            <div className="flex items-center justify-between py-1">
              <div>
                <p className="text-sm font-medium text-gray-900">Required</p>
                <p className="text-xs text-gray-500">Customers must fill this in before submitting</p>
              </div>
              <button type="button" onClick={() => setRequired(r => !r)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${required ? 'bg-brand-500' : 'bg-gray-200'}`}>
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${required ? 'translate-x-6' : 'translate-x-1'}`} />
              </button>
            </div>
            <div>
              <label className={labelCls}>Default value <span className="text-gray-400 font-normal">(optional)</span></label>
              {(fieldType === 'select' || fieldType === 'radio') && (
                <select value={defaultValue ?? ''} onChange={e => setDefaultValue(e.target.value || null)} className={inputCls}>
                  <option value="">No default</option>
                  {realOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              )}
              {fieldType === 'checkbox' && (
                <select value={defaultValue === true ? 'true' : defaultValue === false ? 'false' : ''} onChange={e => setDefaultValue(e.target.value === '' ? null : e.target.value === 'true')} className={inputCls}>
                  <option value="">No default</option>
                  <option value="false">Unchecked</option>
                  <option value="true">Checked</option>
                </select>
              )}
              {(fieldType === 'text' || fieldType === 'textarea') && (
                <input type="text" value={defaultValue ?? ''} onChange={e => setDefaultValue(e.target.value || null)} placeholder="Leave blank for no default" className={inputCls} />
              )}
              {fieldType === 'number' && (
                <input type="number" value={defaultValue ?? ''} onChange={e => setDefaultValue(e.target.value === '' ? null : Number(e.target.value))} placeholder="Leave blank for no default" className={inputCls} />
              )}
            </div>
            {error && <div className="flex items-center gap-2 text-xs text-red-600 bg-red-50 px-3 py-2 rounded-lg"><AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />{error}</div>}
            <div className="flex items-center gap-3 pt-1">
              <button type="submit" disabled={saving} className="flex items-center gap-2 px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50">
                {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}{saving ? 'Saving…' : 'Save field'}
              </button>
              <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors">Cancel</button>
            </div>
          </form>
          <div className="p-5">
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-4">Preview</p>
            <div className="bg-gray-50 rounded-xl p-5">
              {fieldType === 'checkbox' ? (
                <label className="flex items-center gap-2 cursor-not-allowed">
                  <input type="checkbox" disabled className="w-4 h-4 rounded border-gray-300 cursor-not-allowed" />
                  <span className="text-sm text-gray-700">
                    {previewLabel ? <>{previewLabel}{required && <span className="text-red-500 ml-0.5">*</span>}</> : <em className="text-gray-400">Field label</em>}
                  </span>
                </label>
              ) : (
                <>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {previewLabel ? <>{previewLabel}{required && <span className="text-red-500 ml-0.5">*</span>}</> : <em className="text-gray-400 font-normal">Field label</em>}
                  </label>
                  {fieldType === 'text' && <input type="text" disabled placeholder="Your answer" className={disabledInputCls} />}
                  {fieldType === 'textarea' && <textarea disabled placeholder="Your answer" rows={3} className={disabledInputCls} />}
                  {fieldType === 'number' && <input type="number" disabled placeholder="0" className={disabledInputCls} />}
                  {fieldType === 'select' && (realOptions.length > 0
                    ? <select disabled className={disabledInputCls}><option>Select an option…</option>{realOptions.map((o, i) => <option key={i}>{o.label}</option>)}</select>
                    : <p className="text-xs text-gray-400 italic mt-1">Add options on the left</p>)}
                  {fieldType === 'radio' && (realOptions.length > 0
                    ? <div className="space-y-2">{realOptions.map((o, i) => (
                        <label key={i} className="flex items-center gap-2 cursor-not-allowed">
                          <input type="radio" disabled className="w-4 h-4 border-gray-300 cursor-not-allowed" />
                          <span className="text-sm text-gray-700">{o.label}</span>
                        </label>
                      ))}</div>
                    : <p className="text-xs text-gray-400 italic mt-1">Add options on the left</p>)}
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── SortableFieldRow ─────────────────────────────────────────────────────────

interface SortableFieldRowProps {
  placement: FieldPlacement
  customFields: CustomField[]
  onRemove: (id: string) => void
  overlay?: boolean
}

function SortableFieldRow({ placement, customFields, onRemove, overlay = false }: SortableFieldRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: placement.id,
    data: { type: 'field', stepId: placement.step_id },
  })
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging && !overlay ? 0.3 : 1,
  }

  const isBuiltin = placement.field_type === 'builtin'
  const label = isBuiltin
    ? BUILTIN_FIELD_LABELS[placement.field_key] ?? placement.field_key
    : customFields.find(f => f.id === placement.field_key)?.label ?? placement.field_key
  const cfType = !isBuiltin ? customFields.find(f => f.id === placement.field_key)?.field_type : null
  const typeBadgeCls = cfType ? (TYPE_BADGE[cfType] ?? 'bg-gray-100 text-gray-700') : null

  return (
    <div ref={setNodeRef} style={style}
      className={`flex items-center gap-2 px-3 py-2 bg-white border rounded-lg group ${isDragging && !overlay ? 'border-brand-300' : 'border-gray-200'}`}>
      <button {...attributes} {...listeners} className="flex-shrink-0 p-0.5 text-gray-300 hover:text-gray-500 cursor-grab active:cursor-grabbing touch-none">
        <GripVertical className="w-3.5 h-3.5" />
      </button>
      <span className="flex-1 text-sm text-gray-800 truncate">{label}</span>
      {isBuiltin
        ? <span className="flex-shrink-0 text-xs font-semibold px-1.5 py-0.5 rounded bg-gray-100 text-gray-500 uppercase tracking-wide">Built-in</span>
        : cfType && <span className={`flex-shrink-0 text-xs font-medium px-2 py-0.5 rounded-full ${typeBadgeCls}`}>{FIELD_TYPES.find(t => t.value === cfType)?.label ?? cfType}</span>
      }
      <button onClick={() => onRemove(placement.id)} className="flex-shrink-0 p-1 rounded hover:bg-red-50 text-gray-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100">
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  )
}

// ─── DroppableStepBody ────────────────────────────────────────────────────────

function DroppableStepBody({ stepId, children }: { stepId: string; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id: `body-${stepId}`, data: { type: 'step-body', stepId } })
  return (
    <div ref={setNodeRef} className={`min-h-[40px] space-y-2 rounded-lg transition-colors ${isOver ? 'bg-brand-50' : ''}`}>
      {children}
    </div>
  )
}

// ─── AddFieldMenu ─────────────────────────────────────────────────────────────

interface AddFieldMenuProps {
  stepId: string
  allPlacements: FieldPlacement[]
  customFields: CustomField[]
  onAddBuiltin: (stepId: string, key: string) => void
  onAddCustom: (stepId: string, fieldId: string) => void
  onCreateNew: () => void
  onClose: () => void
}

function AddFieldMenu({ stepId, allPlacements, customFields, onAddBuiltin, onAddCustom, onCreateNew, onClose }: AddFieldMenuProps) {
  const placedKeys = new Set(allPlacements.map(p => p.field_key))
  const availableBuiltins = BUILTIN_KEYS.filter(k => !placedKeys.has(k))
  const availableCustom = customFields.filter(f => !placedKeys.has(f.id))
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) onClose()
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [onClose])

  return (
    <div ref={menuRef} className="absolute left-0 bottom-full mb-1 z-30 w-64 bg-white border border-gray-200 rounded-xl shadow-lg py-1 text-sm">
      {availableBuiltins.length > 0 && (
        <>
          <p className="px-3 py-1.5 text-xs font-semibold text-gray-400 uppercase tracking-wide">Built-in fields</p>
          {availableBuiltins.map(key => (
            <button key={key} onClick={() => { onAddBuiltin(stepId, key); onClose() }}
              className="w-full flex items-center gap-2 px-3 py-2 hover:bg-gray-50 text-left text-gray-800">
              <span className="flex-1">{BUILTIN_FIELD_LABELS[key]}</span>
              <span className="text-xs font-semibold px-1.5 py-0.5 rounded bg-gray-100 text-gray-500 uppercase tracking-wide">Built-in</span>
            </button>
          ))}
        </>
      )}
      {availableCustom.length > 0 && (
        <>
          <p className="px-3 py-1.5 text-xs font-semibold text-gray-400 uppercase tracking-wide border-t border-gray-100 mt-1 pt-2">Custom fields</p>
          {availableCustom.map(f => (
            <button key={f.id} onClick={() => { onAddCustom(stepId, f.id); onClose() }}
              className="w-full flex items-center gap-2 px-3 py-2 hover:bg-gray-50 text-left text-gray-800">
              <span className="flex-1 truncate">{f.label}</span>
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${TYPE_BADGE[f.field_type] ?? 'bg-gray-100 text-gray-700'}`}>{FIELD_TYPES.find(t => t.value === f.field_type)?.label ?? f.field_type}</span>
            </button>
          ))}
        </>
      )}
      <div className="border-t border-gray-100 mt-1 pt-1">
        <button onClick={() => { onCreateNew(); onClose() }} className="w-full flex items-center gap-2 px-3 py-2 hover:bg-brand-50 text-brand-600 font-medium text-left">
          <Plus className="w-4 h-4" />Create new custom field
        </button>
      </div>
      {availableBuiltins.length === 0 && availableCustom.length === 0 && (
        <p className="px-3 py-3 text-xs text-gray-400 text-center">All fields are placed. Create a new custom field to add more.</p>
      )}
    </div>
  )
}

// ─── StepCard ─────────────────────────────────────────────────────────────────

interface StepCardProps {
  step: FormStep
  placements: FieldPlacement[]
  allPlacements: FieldPlacement[]
  customFields: CustomField[]
  stepIndex: number
  isLast: boolean
  canDelete: boolean
  openMenuStepId: string | null
  setOpenMenuStepId: (id: string | null) => void
  onUpdateLabel: (stepId: string, label: string) => void
  onDelete: (stepId: string) => void
  onAddBuiltin: (stepId: string, key: string) => void
  onAddCustom: (stepId: string, fieldId: string) => void
  onCreateNewField: (stepId: string) => void
  onRemoveField: (placementId: string) => void
}

function StepCard({
  step, placements, allPlacements, customFields, stepIndex, isLast, canDelete,
  openMenuStepId, setOpenMenuStepId,
  onUpdateLabel, onDelete, onAddBuiltin, onAddCustom, onCreateNewField, onRemoveField,
}: StepCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: step.id, data: { type: 'step' },
  })
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 }
  const isMenuOpen = openMenuStepId === step.id

  return (
    <div ref={setNodeRef} style={style} className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      {/* Step header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100 bg-gray-50">
        <button {...attributes} {...listeners} className="flex-shrink-0 p-0.5 text-gray-300 hover:text-gray-500 cursor-grab active:cursor-grabbing touch-none">
          <GripVertical className="w-4 h-4" />
        </button>
        <span className="flex-shrink-0 text-xs font-bold text-gray-400 uppercase tracking-wider w-14">Step {stepIndex + 1}</span>
        <div className="flex-1 flex items-center gap-2">
          <label className="text-xs text-gray-500 flex-shrink-0">{isLast ? 'Submit label:' : 'Next label:'}</label>
          <input
            type="text"
            value={step.next_button_label}
            onChange={e => onUpdateLabel(step.id, e.target.value)}
            placeholder={isLast ? 'Submit' : 'Next'}
            className="flex-1 text-sm border border-gray-200 rounded-lg px-2 py-1 text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>
        <button
          onClick={() => {
            if (!canDelete) return
            if (confirm(`Delete Step ${stepIndex + 1}? Any fields placed in this step will be removed.`)) onDelete(step.id)
          }}
          disabled={!canDelete}
          className="flex-shrink-0 p-1.5 rounded-lg hover:bg-red-50 text-gray-300 hover:text-red-500 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          title="Delete step"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Field placements */}
      <div className="p-3">
        <SortableContext items={placements.map(p => p.id)} strategy={verticalListSortingStrategy}>
          <DroppableStepBody stepId={step.id}>
            {placements.length === 0 && (
              <p className="text-xs text-gray-400 italic text-center py-4">Drop fields here or use + Add field below</p>
            )}
            {placements.map(p => (
              <SortableFieldRow key={p.id} placement={p} customFields={customFields} onRemove={onRemoveField} />
            ))}
          </DroppableStepBody>
        </SortableContext>
      </div>

      {/* Add field footer */}
      <div className="px-3 pb-3 relative">
        <button
          onClick={() => setOpenMenuStepId(isMenuOpen ? null : step.id)}
          className="flex items-center gap-1.5 text-xs text-brand-600 hover:text-brand-700 font-medium"
        >
          <Plus className="w-3.5 h-3.5" />Add field
          <ChevronDown className={`w-3 h-3 transition-transform ${isMenuOpen ? 'rotate-180' : ''}`} />
        </button>
        {isMenuOpen && (
          <AddFieldMenu
            stepId={step.id}
            allPlacements={allPlacements}
            customFields={customFields}
            onAddBuiltin={onAddBuiltin}
            onAddCustom={onAddCustom}
            onCreateNew={() => onCreateNewField(step.id)}
            onClose={() => setOpenMenuStepId(null)}
          />
        )}
      </div>
    </div>
  )
}

// ─── PreviewStepCard ──────────────────────────────────────────────────────────

function PreviewStepCard({
  step, placements, customFields, isLast, formTitle, formSubtitle, stepIndex,
}: {
  step: FormStep; placements: FieldPlacement[]; customFields: CustomField[]
  isLast: boolean; formTitle: string; formSubtitle: string; stepIndex: number
}) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-4">
      {stepIndex === 0 && (
        <div className="mb-2">
          <h3 className="text-lg font-bold text-gray-900">{formTitle || <em className="text-gray-400 font-normal text-base">Booking form title</em>}</h3>
          {formSubtitle && <p className="text-sm text-gray-500 mt-1">{formSubtitle}</p>}
        </div>
      )}
      <div className="flex items-center gap-2 mb-1">
        <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Step {stepIndex + 1}</span>
        {placements.length === 0 && <span className="text-xs text-gray-400 italic">— empty step</span>}
      </div>
      <div className="space-y-4">
        {placements.map(p => {
          if (p.field_type === 'builtin') {
            return (
              <div key={p.id} className="rounded-lg border border-gray-100 bg-gray-50 px-4 py-3 text-sm text-gray-600 font-medium flex items-center gap-2">
                <LayoutGrid className="w-4 h-4 text-gray-400 flex-shrink-0" />
                {BUILTIN_FIELD_LABELS[p.field_key] ?? p.field_key}
              </div>
            )
          }
          const cf = customFields.find(f => f.id === p.field_key)
          if (!cf) return null
          return (
            <div key={p.id}>
              <CustomFieldPreview field={cf} />
            </div>
          )
        })}
      </div>
      {placements.length > 0 && (
        <button disabled className="w-full mt-2 px-4 py-2 bg-brand-500 text-white text-sm font-medium rounded-lg opacity-60 cursor-not-allowed">
          {step.next_button_label || (isLast ? 'Submit' : 'Next')}
        </button>
      )}
    </div>
  )
}

// ─── FormBuilderPage ──────────────────────────────────────────────────────────

export default function FormBuilderPage() {
  const router = useRouter()
  const supabase = createClient()

  const [profile, setProfile] = useState<any>(null)
  const [business, setBusiness] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [flash, setFlash] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const [savedState, setSavedState] = useState<AppState | null>(null)
  const [localState, setLocalState] = useState<AppState | null>(null)
  const localStateRef = useRef<AppState | null>(null)

  // keep ref in sync for use in DnD handlers
  useEffect(() => { localStateRef.current = localState }, [localState])

  const [openMenuStepId, setOpenMenuStepId] = useState<string | null>(null)
  const [fieldModalStepId, setFieldModalStepId] = useState<string | null>(null) // step to add new field to
  const [activeId, setActiveId] = useState<string | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const isDirty = savedState && localState ? !stateEqual(savedState, localState) : false

  // ── Load ────────────────────────────────────────────────────────────────────

  useEffect(() => { load() }, [])

  async function load() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/auth/login'); return }

    const { data: prof } = await supabase.from('profiles').select('*, businesses(*)').eq('id', user.id).single()
    const biz = Array.isArray(prof?.businesses) ? prof.businesses[0] : prof?.businesses
    setProfile(prof)
    setBusiness(biz)

    if (!biz?.id) { setLoadError('Business not found'); setLoading(false); return }

    const [formRes, customFieldsRes] = await Promise.all([
      supabase.from('booking_forms').select('id, title, subtitle').eq('business_id', biz.id).single(),
      supabase.from('custom_fields').select('*').eq('business_id', biz.id).eq('is_active', true).order('sort_order'),
    ])

    if (!formRes.data) { setLoadError('No booking form found for this business. Please contact support.'); setLoading(false); return }

    const stepsRes = await supabase.from('booking_form_steps').select('*').eq('form_id', formRes.data.id).order('sort_order')
    const stepIds = (stepsRes.data ?? []).map((s: any) => s.id)
    const placementsRes = stepIds.length > 0
      ? await supabase.from('booking_form_field_placements').select('*').in('step_id', stepIds).order('sort_order')
      : { data: [] }

    const state: AppState = {
      form: { id: formRes.data.id, title: formRes.data.title ?? '', subtitle: formRes.data.subtitle ?? '' },
      steps: (stepsRes.data ?? []).map(s => ({ id: s.id, form_id: s.form_id, sort_order: s.sort_order, next_button_label: s.next_button_label ?? '' })),
      placements: (placementsRes.data ?? []).map((p: any) => ({ id: p.id, step_id: p.step_id, field_key: p.builtin_field_key ?? p.custom_field_id, field_type: p.builtin_field_key ? 'builtin' : 'custom', sort_order: p.sort_order })),
      customFields: customFieldsRes.data ?? [],
    }

    setSavedState(state)
    setLocalState(state)
    setLoading(false)
  }

  // ── Flash helper ────────────────────────────────────────────────────────────

  function showFlash(type: 'success' | 'error', text: string) {
    setFlash({ type, text })
    setTimeout(() => setFlash(null), 3500)
  }

  // ── Save ────────────────────────────────────────────────────────────────────

  async function handleSave() {
    if (!localState || !savedState) return
    setSaving(true)
    try {
      const { form, steps, placements } = localState
      const { steps: savedSteps, placements: savedPlacements } = savedState

      // 1. Update form title/subtitle
      await supabase.from('booking_forms').update({ title: form.title, subtitle: form.subtitle }).eq('id', form.id)

      // 2. Deleted steps
      const deletedStepIds = savedSteps.filter(s => !steps.find(ls => ls.id === s.id)).map(s => s.id)
      if (deletedStepIds.length > 0) {
        await supabase.from('booking_form_field_placements').delete().in('step_id', deletedStepIds)
        await supabase.from('booking_form_steps').delete().in('id', deletedStepIds)
      }

      // 3. Insert new steps (temp IDs)
      const newSteps = steps.filter(s => s.id.startsWith('tmp-'))
      const tempToReal: Record<string, string> = {}
      for (const s of newSteps) {
        const { data, error } = await supabase.from('booking_form_steps').insert({
          form_id: form.id, sort_order: s.sort_order, next_button_label: s.next_button_label || null,
        }).select('id').single()
        if (error) throw new Error(error.message)
        tempToReal[s.id] = data.id
      }

      // 4. Update existing steps
      const existingSteps = steps.filter(s => !s.id.startsWith('tmp-'))
      await Promise.all(existingSteps.map(s =>
        supabase.from('booking_form_steps').update({ sort_order: s.sort_order, next_button_label: s.next_button_label || null }).eq('id', s.id)
      ))

      // 5. Resolve placement step_ids (replace temp IDs)
      const resolvedPlacements = placements.map(p => ({
        ...p, step_id: tempToReal[p.step_id] ?? p.step_id,
      }))

      // 6. Deleted placements
      const deletedPlacementIds = savedPlacements.filter(p => !placements.find(lp => lp.id === p.id)).map(p => p.id).filter(id => !id.startsWith('tmp-'))
      if (deletedPlacementIds.length > 0) {
        await supabase.from('booking_form_field_placements').delete().in('id', deletedPlacementIds)
      }

      // 7. Insert new placements
      const newPlacements = resolvedPlacements.filter(p => p.id.startsWith('tmp-'))
      if (newPlacements.length > 0) {
        await supabase.from('booking_form_field_placements').insert(newPlacements.map(p => ({
          step_id: p.step_id,
          builtin_field_key: p.field_type === 'builtin' ? p.field_key : null,
          custom_field_id: p.field_type === 'custom' ? p.field_key : null,
          sort_order: p.sort_order,
        })))
      }

      // 8. Update existing placements
      const existingPlacements = resolvedPlacements.filter(p => !p.id.startsWith('tmp-'))
      await Promise.all(existingPlacements.map(p =>
        supabase.from('booking_form_field_placements').update({ step_id: p.step_id, sort_order: p.sort_order }).eq('id', p.id)
      ))

      // Re-fetch clean state
      await load()
      showFlash('success', 'Form saved')
    } catch (e: any) {
      showFlash('error', `Save failed: ${e.message}`)
    } finally {
      setSaving(false)
    }
  }

  // ── Discard ─────────────────────────────────────────────────────────────────

  function handleDiscard() {
    if (!confirm('Discard all unsaved changes?')) return
    setLocalState(savedState)
  }

  // ── Step mutations ───────────────────────────────────────────────────────────

  function addStep() {
    setLocalState(prev => {
      if (!prev) return prev
      const maxOrder = prev.steps.length > 0 ? Math.max(...prev.steps.map(s => s.sort_order)) : -1
      return {
        ...prev,
        steps: [...prev.steps, { id: tmpId(), form_id: prev.form.id, sort_order: maxOrder + 1, next_button_label: '' }],
      }
    })
  }

  function deleteStep(stepId: string) {
    setLocalState(prev => {
      if (!prev) return prev
      return {
        ...prev,
        steps: prev.steps.filter(s => s.id !== stepId).map((s, i) => ({ ...s, sort_order: i })),
        placements: prev.placements.filter(p => p.step_id !== stepId),
      }
    })
  }

  function updateStepLabel(stepId: string, label: string) {
    setLocalState(prev => {
      if (!prev) return prev
      return { ...prev, steps: prev.steps.map(s => s.id === stepId ? { ...s, next_button_label: label } : s) }
    })
  }

  // ── Field mutations ──────────────────────────────────────────────────────────

  function addBuiltinField(stepId: string, key: string) {
    setLocalState(prev => {
      if (!prev) return prev
      const stepPlacements = prev.placements.filter(p => p.step_id === stepId)
      const maxOrder = stepPlacements.length > 0 ? Math.max(...stepPlacements.map(p => p.sort_order)) : -1
      return {
        ...prev,
        placements: [...prev.placements, { id: tmpId(), step_id: stepId, field_key: key, field_type: 'builtin', sort_order: maxOrder + 1 }],
      }
    })
  }

  function addCustomField(stepId: string, fieldId: string) {
    setLocalState(prev => {
      if (!prev) return prev
      const stepPlacements = prev.placements.filter(p => p.step_id === stepId)
      const maxOrder = stepPlacements.length > 0 ? Math.max(...stepPlacements.map(p => p.sort_order)) : -1
      return {
        ...prev,
        placements: [...prev.placements, { id: tmpId(), step_id: stepId, field_key: fieldId, field_type: 'custom', sort_order: maxOrder + 1 }],
      }
    })
  }

  function removeFieldPlacement(placementId: string) {
    setLocalState(prev => {
      if (!prev) return prev
      return { ...prev, placements: prev.placements.filter(p => p.id !== placementId) }
    })
  }

  // ── Create new custom field (from FieldModal) ────────────────────────────────

  async function handleCreateCustomField(data: Omit<CustomField, 'id' | 'sort_order' | 'is_active'>) {
    if (!business || !localState) return
    const maxOrder = localState.customFields.length > 0 ? Math.max(...localState.customFields.map(f => f.sort_order)) : -1
    const { data: inserted, error } = await supabase.from('custom_fields').insert({
      business_id: business.id, ...data, sort_order: maxOrder + 1, is_active: true,
    }).select().single()
    if (error) throw new Error(error.message)

    const targetStepId = fieldModalStepId
    setLocalState(prev => {
      if (!prev) return prev
      const stepPlacements = prev.placements.filter(p => p.step_id === targetStepId)
      const maxPlacementOrder = stepPlacements.length > 0 ? Math.max(...stepPlacements.map(p => p.sort_order)) : -1
      return {
        ...prev,
        customFields: [...prev.customFields, inserted],
        placements: targetStepId
          ? [...prev.placements, { id: tmpId(), step_id: targetStepId, field_key: inserted.id, field_type: 'custom', sort_order: maxPlacementOrder + 1 }]
          : prev.placements,
      }
    })
    setFieldModalStepId(null)
  }

  // ── DnD handlers ─────────────────────────────────────────────────────────────

  function onDragStart({ active }: any) {
    setActiveId(active.id as string)
  }

  function onDragOver({ active, over }: any) {
    if (!over) return
    const activeData = active.data.current
    if (activeData?.type !== 'field') return

    const overData = over.data.current
    const activeStepId = activeData.stepId

    // Determine target step
    let overStepId: string | null = null
    if (overData?.type === 'field') overStepId = overData.stepId
    else if (overData?.type === 'step-body') overStepId = overData.stepId
    else if (overData?.type === 'step') overStepId = over.id as string

    if (!overStepId || overStepId === activeStepId) return

    // Move placement to new step
    setLocalState(prev => {
      if (!prev) return prev
      const targetStepPlacements = prev.placements.filter(p => p.step_id === overStepId)
      const maxOrder = targetStepPlacements.length > 0 ? Math.max(...targetStepPlacements.map(p => p.sort_order)) : -1
      return {
        ...prev,
        placements: prev.placements.map(p =>
          p.id === active.id ? { ...p, step_id: overStepId!, sort_order: maxOrder + 1 } : p
        ),
      }
    })
  }

  function onDragEnd({ active, over }: any) {
    setActiveId(null)
    if (!over || !localStateRef.current) return
    const ls = localStateRef.current
    const activeData = active.data.current

    if (activeData?.type === 'step') {
      const oldIdx = ls.steps.findIndex(s => s.id === active.id)
      const newIdx = ls.steps.findIndex(s => s.id === over.id)
      if (oldIdx !== newIdx && newIdx >= 0) {
        setLocalState(prev => {
          if (!prev) return prev
          return { ...prev, steps: arrayMove(prev.steps, oldIdx, newIdx).map((s, i) => ({ ...s, sort_order: i })) }
        })
      }
    } else if (activeData?.type === 'field') {
      // Find current step from state (may have been updated by onDragOver)
      const currentPlacement = ls.placements.find(p => p.id === active.id)
      if (!currentPlacement) return
      const stepId = currentPlacement.step_id
      const stepPlacements = ls.placements.filter(p => p.step_id === stepId).sort((a, b) => a.sort_order - b.sort_order)
      const overPlacement = ls.placements.find(p => p.id === over.id)

      if (overPlacement && overPlacement.step_id === stepId) {
        const oldIdx = stepPlacements.findIndex(p => p.id === active.id)
        const newIdx = stepPlacements.findIndex(p => p.id === over.id)
        if (oldIdx !== newIdx && newIdx >= 0) {
          setLocalState(prev => {
            if (!prev) return prev
            const reordered = arrayMove(stepPlacements, oldIdx, newIdx).map((p, i) => ({ ...p, sort_order: i }))
            return { ...prev, placements: [...prev.placements.filter(p => p.step_id !== stepId), ...reordered] }
          })
        }
      }
    }
  }

  // ── Active item for overlay ──────────────────────────────────────────────────

  const activeItem = activeId && localState
    ? localState.placements.find(p => p.id === activeId) ?? localState.steps.find(s => s.id === activeId)
    : null

  // ── Render ───────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex h-screen overflow-hidden bg-gray-50">
        <Sidebar profile={profile} business={business} />
        <div className="flex flex-col flex-1 overflow-hidden">
          <Topbar profile={profile} business={business} />
          <main className="flex-1 flex items-center justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
          </main>
        </div>
      </div>
    )
  }

  if (loadError || !localState) {
    return (
      <div className="flex h-screen overflow-hidden bg-gray-50">
        <Sidebar profile={profile} business={business} />
        <div className="flex flex-col flex-1 overflow-hidden">
          <Topbar profile={profile} business={business} />
          <main className="flex-1 flex items-center justify-center p-6">
            <div className="flex items-center gap-3 text-red-600 bg-red-50 border border-red-200 rounded-xl px-5 py-4">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <p className="text-sm font-medium">{loadError ?? 'Failed to load form data.'}</p>
            </div>
          </main>
        </div>
      </div>
    )
  }

  const { form, steps, placements, customFields } = localState

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      <Sidebar profile={profile} business={business} />
      <div className="flex flex-col flex-1 overflow-hidden">
        <Topbar profile={profile} business={business} />
        <main className="flex-1 overflow-y-auto">
          <div className="max-w-7xl mx-auto p-6 space-y-6">

            {/* Header */}
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Form Builder</h2>
                <p className="text-sm text-gray-500 mt-0.5">Drag fields between steps to build your booking form.</p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                {isDirty && <span className="text-xs text-amber-600 font-medium flex items-center gap-1"><span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-500" />Unsaved changes</span>}
                <button onClick={handleDiscard} disabled={!isDirty}
                  className="px-3 py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
                  Discard
                </button>
                <button onClick={handleSave} disabled={!isDirty || saving}
                  className="flex items-center gap-2 px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                  {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  {saving ? 'Saving…' : 'Save changes'}
                </button>
              </div>
            </div>

            {flash && (
              <div className={`flex items-center gap-2 px-4 py-3 rounded-lg text-sm ${flash.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
                {flash.type === 'success' ? <CheckCircle2 className="w-4 h-4 flex-shrink-0" /> : <AlertCircle className="w-4 h-4 flex-shrink-0" />}
                {flash.text}
              </div>
            )}

            {/* Form title / subtitle inputs */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>Form title</label>
                <input type="text" value={form.title} onChange={e => setLocalState(p => p ? { ...p, form: { ...p.form, title: e.target.value } } : p)}
                  placeholder="Booking form title" className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Subtitle <span className="text-gray-400 font-normal">(optional)</span></label>
                <input type="text" value={form.subtitle} onChange={e => setLocalState(p => p ? { ...p, form: { ...p.form, subtitle: e.target.value } } : p)}
                  placeholder="Optional subtitle shown on first step" className={inputCls} />
              </div>
            </div>

            {/* Two-column builder + preview */}
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragStart={onDragStart}
              onDragOver={onDragOver}
              onDragEnd={onDragEnd}
            >
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">

                {/* LEFT: Builder */}
                <div className="space-y-3">
                  <SortableContext items={steps.map(s => s.id)} strategy={verticalListSortingStrategy}>
                    {steps.map((step, idx) => (
                      <StepCard
                        key={step.id}
                        step={step}
                        placements={placements.filter(p => p.step_id === step.id).sort((a, b) => a.sort_order - b.sort_order)}
                        allPlacements={placements}
                        customFields={customFields}
                        stepIndex={idx}
                        isLast={idx === steps.length - 1}
                        canDelete={steps.length > 1}
                        openMenuStepId={openMenuStepId}
                        setOpenMenuStepId={setOpenMenuStepId}
                        onUpdateLabel={updateStepLabel}
                        onDelete={deleteStep}
                        onAddBuiltin={addBuiltinField}
                        onAddCustom={addCustomField}
                        onCreateNewField={(sid) => { setFieldModalStepId(sid) }}
                        onRemoveField={removeFieldPlacement}
                      />
                    ))}
                  </SortableContext>

                  <button onClick={addStep}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed border-gray-200 hover:border-brand-300 hover:text-brand-600 text-gray-400 text-sm font-medium rounded-xl transition-colors">
                    <Plus className="w-4 h-4" />Add step
                  </button>
                </div>

                {/* RIGHT: Preview */}
                <div className="lg:sticky lg:top-6 self-start space-y-4">
                  <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Preview</p>
                  {steps.map((step, idx) => (
                    <PreviewStepCard
                      key={step.id}
                      step={step}
                      placements={placements.filter(p => p.step_id === step.id).sort((a, b) => a.sort_order - b.sort_order)}
                      customFields={customFields}
                      isLast={idx === steps.length - 1}
                      formTitle={form.title}
                      formSubtitle={form.subtitle}
                      stepIndex={idx}
                    />
                  ))}
                </div>
              </div>

              <DragOverlay>
                {activeId && localState && (() => {
                  const activePlacement = localState.placements.find(p => p.id === activeId)
                  if (activePlacement) {
                    return (
                      <div className="shadow-xl rounded-lg opacity-90">
                        <SortableFieldRow placement={activePlacement} customFields={localState.customFields} onRemove={() => {}} overlay />
                      </div>
                    )
                  }
                  const activeStep = localState.steps.find(s => s.id === activeId)
                  if (activeStep) {
                    return (
                      <div className="bg-white border border-gray-200 rounded-xl px-4 py-3 shadow-xl opacity-90 text-sm font-medium text-gray-700">
                        Step {localState.steps.findIndex(s => s.id === activeId) + 1}
                      </div>
                    )
                  }
                  return null
                })()}
              </DragOverlay>
            </DndContext>
          </div>
        </main>
      </div>

      {fieldModalStepId !== null && (
        <FieldModal
          initial={null}
          onClose={() => setFieldModalStepId(null)}
          onSave={handleCreateCustomField}
        />
      )}
    </div>
  )
}
