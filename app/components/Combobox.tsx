'use client'

import { useState, useRef, useEffect } from 'react'
import { ChevronDown, X } from 'lucide-react'

export interface ComboOption { id: string; label: string; sublabel?: string }

/** Wyszukiwalny select (typeahead) — działa przy setkach pozycji. */
export default function Combobox({
  options,
  value,
  onChange,
  placeholder = '— wybierz —',
  accent = 'blue',
}: {
  options: ComboOption[]
  value: string
  onChange: (id: string) => void
  placeholder?: string
  accent?: 'blue' | 'purple'
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const ref = useRef<HTMLDivElement>(null)

  const selected = options.find(o => o.id === value)

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) { setOpen(false); setQuery('') }
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  const q = query.trim().toLowerCase()
  const filtered = q
    ? options.filter(o => o.label.toLowerCase().includes(q) || o.sublabel?.toLowerCase().includes(q))
    : options
  const ring = accent === 'purple' ? 'focus:ring-purple-500' : 'focus:ring-blue-500'

  return (
    <div ref={ref} className="relative">
      {!open ? (
        <button type="button" onClick={() => { setOpen(true); setTimeout(() => ref.current?.querySelector('input')?.focus(), 0) }}
          className={`w-full flex items-center justify-between border border-gray-300 rounded-lg px-3 py-2 text-sm text-left ${selected ? 'text-gray-900' : 'text-gray-400'}`}>
          <span className="truncate">{selected ? selected.label : placeholder}</span>
          <span className="flex items-center gap-1 shrink-0">
            {selected && (
              <X size={14} className="text-gray-400 hover:text-red-500" onClick={e => { e.stopPropagation(); onChange('') }} />
            )}
            <ChevronDown size={16} className="text-gray-400" />
          </span>
        </button>
      ) : (
        <input autoFocus value={query} onChange={e => setQuery(e.target.value)}
          placeholder="Wpisz aby wyszukać..."
          className={`w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:ring-2 ${ring}`} />
      )}

      {open && (
        <div className="absolute z-[80] mt-1 w-full max-h-56 overflow-y-auto bg-white border border-gray-200 rounded-lg shadow-lg">
          {filtered.length === 0 ? (
            <p className="px-3 py-3 text-sm text-gray-400 text-center">Brak wyników</p>
          ) : (
            filtered.slice(0, 60).map(o => (
              <button key={o.id} type="button"
                onClick={() => { onChange(o.id); setOpen(false); setQuery('') }}
                className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 ${o.id === value ? 'bg-blue-50' : ''}`}>
                <span className="text-gray-900">{o.label}</span>
                {o.sublabel && <span className="text-gray-400 ml-2 text-xs">{o.sublabel}</span>}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  )
}
