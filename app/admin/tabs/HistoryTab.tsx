'use client'

import { useState, useEffect } from 'react'
import { Plus, Pencil, Trash2, Shield, GraduationCap, RotateCw } from 'lucide-react'

interface AuditRow {
  id: string
  created_at: string
  actor_type: 'admin' | 'tutor'
  actor_name: string
  action: 'create' | 'update' | 'delete'
  summary: string
}

const ACTION_META: Record<string, { label: string; cls: string; icon: React.ReactNode }> = {
  create: { label: 'Dodano', cls: 'bg-green-50 text-green-700', icon: <Plus size={13} /> },
  update: { label: 'Edytowano', cls: 'bg-blue-50 text-blue-700', icon: <Pencil size={13} /> },
  delete: { label: 'Usunięto', cls: 'bg-red-50 text-red-700', icon: <Trash2 size={13} /> },
}

export default function HistoryTab({ password }: { password: string }) {
  const [rows, setRows] = useState<AuditRow[]>([])
  const [loading, setLoading] = useState(true)

  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${password}` }

  const load = async () => {
    setLoading(true)
    const res = await fetch('/api/admin/audit?limit=200', { headers })
    if (res.ok) setRows(await res.json())
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const fmt = (iso: string) =>
    new Date(iso).toLocaleString('pl-PL', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">Historia zmian</h2>
        <button onClick={load} className="flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900 border border-gray-300 rounded-lg px-3 py-1.5">
          <RotateCw size={14} /> Odśwież
        </button>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? (
          <p className="px-6 py-10 text-center text-gray-400 text-sm">Ładowanie...</p>
        ) : rows.length === 0 ? (
          <p className="px-6 py-10 text-center text-gray-400 text-sm">Brak zapisanych zmian</p>
        ) : (
          <div className="divide-y divide-gray-100">
            {rows.map(row => {
              const meta = ACTION_META[row.action] ?? ACTION_META.update
              return (
                <div key={row.id} className="px-4 sm:px-6 py-3 flex items-start gap-3">
                  <span className={`shrink-0 mt-0.5 flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium ${meta.cls}`}>
                    {meta.icon} {meta.label}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-gray-900 break-words">{row.summary}</p>
                    <p className="text-xs text-gray-400 mt-0.5 flex items-center gap-1">
                      {row.actor_type === 'tutor'
                        ? <><GraduationCap size={11} /> {row.actor_name}</>
                        : <><Shield size={11} /> {row.actor_name}</>}
                      <span>·</span>
                      <span>{fmt(row.created_at)}</span>
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
