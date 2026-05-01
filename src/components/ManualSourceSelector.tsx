// @ts-nocheck
'use client'

interface ManualSourceSelectorProps {
  value: string
  onChange: (val: string) => void
  campaignLabel: string
  onCampaignLabelChange: (val: string) => void
  campaigns: string[] // existing campaign names from past lead_sources
}

const SOURCE_OPTIONS = [
  { value: 'paid_search', label: '🎯 Google Ads (paid)' },
  { value: 'organic', label: '🔍 Google (organic)' },
  { value: 'referral', label: '🤝 Referral' },
  { value: 'direct', label: '📞 Direct / Phone' },
  { value: 'social', label: '📱 Social media' },
  { value: 'email', label: '📧 Email campaign' },
  { value: 'manual', label: '✏️ Other (manual)' },
]

export default function ManualSourceSelector({
  value, onChange, campaignLabel, onCampaignLabelChange, campaigns
}: ManualSourceSelectorProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.7rem' }}>
      <div>
        <label style={labelStyle}>Lead source</label>
        <select
          value={value}
          onChange={e => onChange(e.target.value)}
          style={inputStyle}
        >
          <option value="">Select source...</option>
          {SOURCE_OPTIONS.map(o => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>

      {(value === 'paid_search' || value === 'manual') && (
        <div>
          <label style={labelStyle}>Campaign name</label>
          <input
            type="text"
            value={campaignLabel}
            onChange={e => onCampaignLabelChange(e.target.value)}
            placeholder="e.g. Residential Melbourne"
            list="campaign-suggestions"
            style={inputStyle}
          />
          <datalist id="campaign-suggestions">
            {campaigns.map(c => <option key={c} value={c} />)}
          </datalist>
        </div>
      )}
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '0.55rem 0.8rem',
  borderRadius: 8, border: '1px solid #e5e7eb',
  fontSize: '0.88rem', color: '#111827',
  background: '#fff', fontFamily: "'DM Sans', sans-serif",
  outline: 'none',
}

const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: '0.78rem', fontWeight: 600,
  color: '#374151', marginBottom: '0.3rem',
}
