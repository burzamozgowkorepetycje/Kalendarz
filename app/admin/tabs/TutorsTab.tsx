'use client'

import { useState, useEffect } from 'react'
import { Plus, Trash2, Copy } from 'lucide-react'
import { Tutor } from '@/lib/types'

export default function TutorsTab({ password }: { password: string }) {
  const [tutors, setTutors] = useState<Tutor[]>([])
  const [form, setForm] = useState({ name: '', email: '', phone: '' })
  const [loading, setLoading] = useState(false)

  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${password}` }

  useEffect(() => {
    fetch('/api/admin/tutors', { headers }).then(r => r.json()).then(setTutors)
  }, [])

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name || !form.email) return
    setLoading(true)
    const res = await fetch('/api/admin/tutors', {
      method: 'POST',
      headers,
      body: JSON.stringify(form),
    })
    if (res.ok) {
      const tutor = await res.json()
      setTutors([tutor, ...tutors])
      setForm({ name: '', email: '', phone: '' })
    }
    setLoading(false)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Usunąć korepetytora?')) return
    const res = await fetch(`/api/admin/tutors?id=${id}`, { method: 'DELETE', headers })
    if (res.ok) setTutors(tutors.filter(t => t.id !== id))
  }

  const copyLink = (link: string) => {
    navigator.clipboard.writeText(`${window.location.origin}/booking?link=${link}`)
    alert('Link skopiowany!')
  }

  return (
    <div className="space-y-6">
      {/* Add form */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2 text-gray-900"><Plus size={18} /> Dodaj korepetytora</h2>
        <form onSubmit={handleAdd} className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <input required placeholder="Imię i nazwisko" value={form.name}
            onChange={e => setForm({ ...form, name: e.target.value })}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-blue-500" />
          <input required type="email" placeholder="Email" value={form.email}
            onChange={e => setForm({ ...form, email: e.target.value })}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-blue-500" />
          <input placeholder="Telefon (+48...)" value={form.phone}
            onChange={e => setForm({ ...form, phone: e.target.value })}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-blue-500" />
          <button type="submit" disabled={loading}
            className="md:col-span-3 bg-blue-600 text-white rounded-lg py-2 text-sm font-semibold hover:bg-blue-700 disabled:opacity-50">
            {loading ? 'Dodawanie...' : 'Dodaj korepetytora'}
          </button>
        </form>
      </div>

      {/* List */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-6 py-3 bg-gray-50 border-b border-gray-200">
          <span className="text-sm font-semibold text-gray-600">Korepetytorzy ({tutors.length})</span>
        </div>
        {tutors.length === 0 ? (
          <p className="px-6 py-8 text-center text-gray-400 text-sm">Brak korepetytorów</p>
        ) : (
          <div className="divide-y divide-gray-100">
            {tutors.map(tutor => (
              <div key={tutor.id} className="px-6 py-4 flex items-center justify-between hover:bg-gray-50">
                <div>
                  <p className="font-medium text-gray-900">{tutor.name}</p>
                  <p className="text-sm text-gray-600">{tutor.email} · {tutor.phone || 'brak telefonu'}</p>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => copyLink(tutor.unique_link)}
                    className="flex items-center gap-1 px-3 py-1.5 bg-blue-50 text-blue-700 rounded-lg text-sm hover:bg-blue-100">
                    <Copy size={14} /> Link
                  </button>
                  <button onClick={() => handleDelete(tutor.id)}
                    className="p-1.5 text-gray-400 hover:text-red-600 rounded-lg hover:bg-red-50">
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
