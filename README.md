# Aplikacja do Rezerwacji Korepetycji

Aplikacja webowa do zarządzania harmonogramem korepetycji, rezerwacjami i powiadomieniami dla korepetytorów.

## Cechy

- 📅 **Kalendarz rezerwacji** - łatwe zarządzanie dostępnymi terminami
- 👥 **Zarządzanie korepetytorami** - dodawaj i usuwaj korepetytorów
- 🔗 **Unikalne linki** - każdy korepetytor ma własny link dostępu
- 📧 **Email powiadomienia** - automatyczne potwierdzenia rezerwacji
- 🔒 **Bezpieczne** - admin panel chroniony hasłem

## Quick Start

### 1. Zainstaluj zależności
```bash
npm install
```

### 2. Skonfiguruj zmienne środowiska
Przeczytaj [SETUP.md](./SETUP.md) dla szczegółowych instrukcji.

### 3. Uruchom dev server
```bash
npm run dev
```

Aplikacja będzie dostępna na http://localhost:3000

## Struktura

- `app/page.tsx` - Strona główna
- `app/admin/page.tsx` - Panel administracyjny
- `app/booking/page.tsx` - Strona rezerwacji (dla korepetytorów)
- `app/api/` - API endpoints
- `lib/` - Utility functions (Supabase, Email itp.)

## Wdrożenie

### Opcja 1: Vercel (Rekomendowane)
1. Push kod na GitHub
2. Wejdź na https://vercel.com
3. Zaimportuj projekt
4. Dodaj zmienne środowiska
5. Deploy!

## Dokumentacja

- [Setup Guide](./SETUP.md) - Szczegółowa konfiguracja Supabase i Resend
