import Link from 'next/link'
import { Shield, GraduationCap } from 'lucide-react'

export default function Home() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-blue-600 to-indigo-800 flex flex-col items-center justify-center px-5 py-12">
      <div className="text-center mb-10">
        <h1 className="text-3xl sm:text-4xl font-bold text-white mb-2">Burza Mózgów</h1>
        <p className="text-blue-100 text-sm sm:text-base">System zarządzania korepetycjami</p>
      </div>

      <div className="w-full max-w-md space-y-4">
        <Link
          href="/admin"
          className="flex items-center gap-4 bg-white rounded-2xl p-5 shadow-lg hover:shadow-xl transition active:scale-[0.99]"
        >
          <div className="bg-blue-100 rounded-xl p-3">
            <Shield className="text-blue-600" size={26} />
          </div>
          <div>
            <p className="font-bold text-gray-900">Panel administratora</p>
            <p className="text-sm text-gray-500">Kalendarz, uczniowie, płatności, raporty</p>
          </div>
        </Link>

        <Link
          href="/tutor/login"
          className="flex items-center gap-4 bg-white rounded-2xl p-5 shadow-lg hover:shadow-xl transition active:scale-[0.99]"
        >
          <div className="bg-emerald-100 rounded-xl p-3">
            <GraduationCap className="text-emerald-600" size={26} />
          </div>
          <div>
            <p className="font-bold text-gray-900">Panel korepetytora</p>
            <p className="text-sm text-gray-500">Twoje zajęcia i grafik sal</p>
          </div>
        </Link>
      </div>

      <p className="text-blue-200 text-xs mt-10 text-center">
        Dodaj tę stronę do ekranu głównego, aby korzystać jak z aplikacji.
      </p>
    </main>
  )
}
