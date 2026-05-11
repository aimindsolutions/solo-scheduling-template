# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev      # Start dev server at localhost:3000
npm run build    # Production build (TypeScript check + compile)
npm run lint     # ESLint
npm run start    # Start production server
```

No test runner is configured. Use `npm run build` to verify TypeScript correctness — it runs full type checking.

Build will fail at page generation if Firebase credentials are missing (`.env.local`), but TypeScript compilation succeeding is the key check.

## Architecture

Solo service business scheduling template: Next.js 16 App Router on Vercel, Firestore as primary data store, Google Calendar as synchronized view, Telegram bot for client interaction.

### Two separate app segments

- **`/[locale]/*`** — Public client-facing pages (landing, booking form, success). Wrapped with `next-intl` for i18n (Ukrainian default, English). Uses `NextIntlClientProvider` in locale layout.
- **`/admin/*`** — Owner dashboard (no i18n). Protected by Firebase Auth guard in `admin/layout.tsx`. Uses client-side Firebase SDK for auth state.

These never share layouts. The middleware (`src/middleware.ts`) handles locale detection for public routes only — admin and API routes are excluded via matcher.

### i18n routing

`next-intl` with URL-based locale prefix. Locales: `uk` (default), `en`. Config chain: `src/i18n/config.ts` → `routing.ts` → `request.ts` (server) → `navigation.ts` (client). Always use `Link`, `useRouter`, `usePathname` from `@/i18n/navigation` in locale pages — not from `next/navigation`.

### Firebase: two SDKs, two contexts

- **`src/lib/firebase/admin.ts`** — Admin SDK with service account. Server-side only (API routes, Telegram handlers, cron). Exports `adminDb`, `adminAuth`.
- **`src/lib/firebase/client.ts`** — Client SDK with public config. Browser-side only (admin dashboard auth). Exports `db`, `auth`.

Never import admin SDK in client components or vice versa.

### API routes

RESTful pattern under `src/app/api/`. Each route uses `adminDb` for Firestore access and returns `NextResponse.json()`. Timestamps are converted from Firestore `Timestamp` to ISO strings in all GET responses.

Auth is per-route: Telegram webhook checks `x-telegram-bot-api-secret-token` header, cron checks `Authorization: Bearer {CRON_SECRET}`, admin API routes currently have no auth middleware.

### Telegram bot flow

Webhook at `POST /api/telegram/webhook` dispatches to `src/lib/telegram/handlers.ts`. Two main flows:

1. **Confirmation flow** — Client books via web → gets link to bot → `/start {appointmentId}` deep link → Confirm/Cancel inline buttons → updates Firestore + Calendar.
2. **Booking flow** — `/book` command → state machine stored in `bookingSessions` Firestore collection (awaiting_name → awaiting_phone → awaiting_date → awaiting_time) → creates appointment directly.

All bot messages are localized via `src/lib/telegram/messages.ts`.

### Google Calendar sync

Service account auth via `googleapis` JWT. Color coding: orange (colorId "6") = booked, green (colorId "10") = confirmed. Calendar event IDs stored on appointment documents for bidirectional reference. `src/lib/calendar/google.ts` wraps all Calendar API calls.

### Slot calculation

`src/lib/slots.ts` — `getAvailableSlots(date, config, existingAppointments)` computes free time slots from working hours minus existing bookings and break slots. Used by both the web API (`/api/appointments/slots`) and Telegram bot handlers.

### Client calendar links

`src/lib/calendar/client-links.ts` generates `.ics` files (with VALARM reminders at 24h and 2h) and Google Calendar URLs. Sent via Telegram after confirmation and available on the booking success page.

### Cron reminders

Vercel cron hits `GET /api/cron/reminders` every 10 minutes. Queries for confirmed appointments needing 24h or 2h reminders, sends via Telegram, marks flags as sent.

## Data model (Firestore)

- `businessConfig/main` — singleton with working hours, service name, duration, timezone
- `clients/{id}` — name, phone (required), consent metadata, appointment counters (total/confirmed/cancelled/noShow)
- `appointments/{id}` — clientId, dateTime, status, source, googleCalendarEventId, reminder flags
- `bookingSessions/{chatId}` — temporary Telegram booking state (auto-deleted on completion)

Appointment statuses: `booked` → `confirmed` → `completed` | `cancelled` | `no_show`.

## Next.js 16 notice

@AGENTS.md — This project uses Next.js 16 which has breaking changes from training data. Check `node_modules/next/dist/docs/` for current API docs. The `middleware` convention is deprecated in favor of `proxy` (warning is expected during build).
