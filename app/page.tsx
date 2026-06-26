import Link from 'next/link'
import { Calendar, Users, Bell, Shield } from 'lucide-react'

export default function Home() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Navigation */}
      <nav className="bg-white shadow-sm">
        <div className="max-w-6xl mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-blue-600">Korepetycje</h1>
          <div className="space-x-4">
            <Link
              href="/admin"
              className="px-4 py-2 text-blue-600 hover:text-blue-800 font-medium"
            >
              Panel Admina
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <div className="max-w-6xl mx-auto px-4 py-20">
        <div className="text-center mb-16">
          <h2 className="text-5xl font-bold text-gray-800 mb-4">
            Kalendarz Rezerwacji Korepetycji
          </h2>
          <p className="text-xl text-gray-600 mb-8">
            Łatwe zarządzanie harmonogramem i rezerwacjami zajęć
          </p>
        </div>

        {/* Features Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
          <div className="bg-white rounded-lg shadow-md p-6 text-center">
            <div className="flex justify-center mb-4">
              <Calendar className="text-blue-600" size={32} />
            </div>
            <h3 className="font-semibold text-lg mb-2">Harmonogram</h3>
            <p className="text-gray-600 text-sm">
              Łatwe zarządzanie dostępnymi terminami
            </p>
          </div>

          <div className="bg-white rounded-lg shadow-md p-6 text-center">
            <div className="flex justify-center mb-4">
              <Users className="text-green-600" size={32} />
            </div>
            <h3 className="font-semibold text-lg mb-2">Korepetytorzy</h3>
            <p className="text-gray-600 text-sm">
              Zarządzaj korepetytorami i ich harmonogramami
            </p>
          </div>

          <div className="bg-white rounded-lg shadow-md p-6 text-center">
            <div className="flex justify-center mb-4">
              <Bell className="text-purple-600" size={32} />
            </div>
            <h3 className="font-semibold text-lg mb-2">Powiadomienia</h3>
            <p className="text-gray-600 text-sm">
              Automatyczne powiadomienia email
            </p>
          </div>

          <div className="bg-white rounded-lg shadow-md p-6 text-center">
            <div className="flex justify-center mb-4">
              <Shield className="text-orange-600" size={32} />
            </div>
            <h3 className="font-semibold text-lg mb-2">Bezpieczne</h3>
            <p className="text-gray-600 text-sm">
              Unikalne linki dostępu dla każdego
            </p>
          </div>
        </div>

        {/* How It Works */}
        <div className="bg-white rounded-lg shadow-md p-12 mb-12">
          <h3 className="text-3xl font-bold text-center mb-8">Jak to działa?</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="bg-blue-100 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl font-bold text-blue-600">1</span>
              </div>
              <h4 className="font-semibold mb-2">Dodaj korepetytorów</h4>
              <p className="text-gray-600">
                Zaloguj się do panelu i dodaj swoich korepetytorów
              </p>
            </div>
            <div className="text-center">
              <div className="bg-green-100 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl font-bold text-green-600">2</span>
              </div>
              <h4 className="font-semibold mb-2">Utwórz czasami sloty</h4>
              <p className="text-gray-600">
                Dodaj dostępne terminy zajęć w kalendarzu
              </p>
            </div>
            <div className="text-center">
              <div className="bg-purple-100 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl font-bold text-purple-600">3</span>
              </div>
              <h4 className="font-semibold mb-2">Udostępnij linki</h4>
              <p className="text-gray-600">
                Prześlij unikalne linki rezerwacji korepetytorem
              </p>
            </div>
          </div>
        </div>

        {/* CTA */}
        <div className="text-center">
          <p className="text-lg text-gray-700 mb-6">
            Gotowy do zarządzania korepetycjami?
          </p>
          <Link
            href="/admin"
            className="inline-block px-8 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition"
          >
            Wejdź do Panelu Admina
          </Link>
        </div>
      </div>
    </main>
  )
}
