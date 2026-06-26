'use client'

import { useState, useEffect } from 'react'
import { Plus, Trash2, Copy, KeyRound, X } from 'lucide-react'
import { Tutor } from '@/lib/types'

interface PasswordModal {
  tutorId: string
  tutorName: string
}

export default function TutorsTab({ password }: { password: string }) {
  const [tutors, setTutors] = useState<Tutor[]>([])
  const [form, setForm] = useState({ name: '', email: '', phone: '' })
  const [loading, setLoading] = useState(false)
  const [passwordModal, setPasswordModal] = useState<PasswordModal | null>(null)
  const [pwForm, setPwForm] = useState({ login: '', password: '', password2: '' })
  const [pwLoading, setPwLoading] = useState(false)
  const [pwError, setPwError] = useState('')
  const [pwSuccess, setPwSuccess] = useState(false)

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

  const openPasswordModal = (tutor: Tutor) => {
    setPasswordModal({ tutorId: tutor.id, tutorName: tutor.name })
    setPwForm({ login: '', password: '', password2: '' })
    setPwError('')
    setPwSuccess(false)
  }

  const handleSetPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setPwError('')
    if (pwForm.password !== pwForm.password2) {
      setPwError('Hasła nie są zgodne')
      return
    }
    if (pwForm.password.length < 6) {
      setPwError('Hasło musi mieć co najmniej 6 znaków')
      return
    }
    setPwLoading(true)
    const res = await fetch('/api/admin/tutors/set-password', {
      method: 'POST',
      headers,
      body: JSON.stringify({ tutor_id: passwordModal!.tutorId, login: pwForm.login, password: pwForm.password }),
    })
    const data = await res.json()
    setPwLoading(false)
    if (res.ok) {
      setPwSuccess(true)
      setTimeout(() => setPasswordModal(null), 1500)
    } else {
      setPwError(data.error || 'Błąd zapisu')
    }
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
                  <button onClick={() => openPasswordModal(tutor)}
                    className="flex items-center gap-1 px-3 py-1.5 bg-green-50 text-green-700 rounded-lg text-sm hover:bg-green-100">
                    <KeyRound size={14} /> Hasło
                  </button>
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

      {/* Password modal */}
      {passwordModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-gray-900">Ustaw login i hasło</h2>
              <button onClick={() => setPasswordModal(null)} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>
            <p className="text-sm text-gray-500 mb-4">{passwordModal.tutorName}</p>
            {pwSuccess ? (
              <p className="text-green-600 text-sm font-medium text-center py-4">Hasło ustawione!</p>
            ) : (
              <form onSubmit={handleSetPassword} className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Login</label>
                  <input
                    required
                    value={pwForm.login}
                    onChange={e => setPwForm({ ...pwForm, login: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:ring-2 focus:ring-blue-500"
                    placeholder="np. jan.kowalski"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Hasło</label>
                  <input
                    required
                    type="password"
                    value={pwForm.password}
                    onChange={e => setPwForm({ ...pwForm, password: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:ring-2 focus:ring-blue-500"
                    placeholder="Min. 6 znaków"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Powtórz hasło</label>
                  <input
                    required
                    type="password"
                    value={pwForm.password2}
                    onChange={e => setPwForm({ ...pwForm, password2: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:ring-2 focus:ring-blue-500"
                    placeholder="••••••••"
                  />
                </div>
                {pwError && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{pwError}</p>}
                <button
                  type="submit"
                  disabled={pwLoading}
                  className="w-full bg-blue-600 text-white rounded-lg py-2 text-sm font-semibold hover:bg-blue-700 disabled:opacity-50"
                >
                  {pwLoading ? 'Zapisywanie...' : 'Zapisz'}
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
