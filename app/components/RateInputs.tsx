'use client'

export interface Rates {
  rate_individual: string
  rate_pair: string
  rate_group: string
}

export const EMPTY_RATES: Rates = { rate_individual: '', rate_pair: '', rate_group: '' }

const FIELDS: { key: keyof Rates; label: string }[] = [
  { key: 'rate_individual', label: 'Indywidualne' },
  { key: 'rate_pair', label: 'Para' },
  { key: 'rate_group', label: 'Grupa' },
]

/** Trzy pola sugerowanych stawek (zł): indywidualne / para / grupa. */
export default function RateInputs({
  value,
  onChange,
  compact,
}: {
  value: Rates
  onChange: (r: Rates) => void
  compact?: boolean
}) {
  return (
    <div className="grid grid-cols-3 gap-2">
      {FIELDS.map(f => (
        <div key={f.key}>
          <label className="block text-xs font-medium text-gray-500 mb-1">{f.label} (zł)</label>
          <input
            type="number"
            inputMode="numeric"
            placeholder="—"
            value={value[f.key]}
            onChange={e => onChange({ ...value, [f.key]: e.target.value })}
            className={`w-full border border-gray-300 rounded-lg px-2 ${compact ? 'py-1.5' : 'py-2'} text-sm text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-blue-500`}
          />
        </div>
      ))}
    </div>
  )
}

/** Konwersja stawek (string) na liczby do wysyłki API. */
export function ratesToNumbers(r: Rates) {
  return {
    rate_individual: r.rate_individual ? Number(r.rate_individual) : null,
    rate_pair: r.rate_pair ? Number(r.rate_pair) : null,
    rate_group: r.rate_group ? Number(r.rate_group) : null,
  }
}
