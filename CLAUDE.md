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

## Deployment

**Two-branch strategy:**
- `main` → Vercel (production backup, untouched)
- `feature/client-auth-gcp` → GCP Cloud Run DEV (active development) — **this is the working branch**

GCP service: `solo-scheduling-dev` at `https://solo-scheduling-dev-3phwuzlvka-uc.a.run.app`
GCP project: `scheduler-56e1a` | Region: `us-central1`
Cloud Build trigger: `deploy-feature-gcp` watches `^feature/client-auth-gcp$`

**To trigger a build manually:**
```bash
gcloud builds triggers run deploy-feature-gcp \
  --branch=feature/client-auth-gcp --project=scheduler-56e1a
```

**NEXT_PUBLIC_* vars must be baked at Docker build time** (not runtime) because Next.js inlines them during webpack compilation. All are passed as `--build-arg` in `cloudbuild.yaml`. Do not move them to runtime-only env vars.

**Telegram webhook** currently points to GCP URL. To update: `gcloud secrets versions access latest --secret=TELEGRAM_BOT_TOKEN --project=scheduler-56e1a`

**Firebase Auth authorized domains** must include the Cloud Run URL — add in Firebase Console → Authentication → Settings → Authorized domains.

## Architecture

Solo service business scheduling template: Next.js 16 App Router, Firestore as primary data store, Google Calendar as synchronized view, Telegram bot for client interaction.

### Two separate app segments

- **`/[locale]/*`** — Public client-facing pages (landing, booking form, success). Wrapped with `next-intl` for i18n (Ukrainian default, English). Uses `NextIntlClientProvider` in locale layout.
- **`/admin/*`** — Owner dashboard (no i18n). Protected by Firebase Auth guard in `admin/layout.tsx`. Uses client-side Firebase SDK for auth state.

These never share layouts. The proxy (`src/proxy.ts`) handles locale detection for public routes only — admin and API routes are excluded via matcher. File is named `proxy.ts` per Next.js 16 convention (was `middleware.ts`).

### i18n routing

`next-intl` with URL-based locale prefix. Locales: `uk` (default), `en`. Config chain: `src/i18n/config.ts` → `routing.ts` → `request.ts` (server) → `navigation.ts` (client). Always use `Link`, `useRouter`, `usePathname` from `@/i18n/navigation` in locale pages — not from `next/navigation`.

### Firebase: two SDKs, two contexts

- **`src/lib/firebase/admin.ts`** — Admin SDK with service account. Server-side only (API routes, Telegram handlers, cron). Exports `adminDb`, `adminAuth` as Proxy objects (lazy init — Firebase only initializes on first API call, not at module load during `next build`).
- **`src/lib/firebase/client.ts`** — Client SDK with public config. Browser-side only (admin dashboard auth). Exports `db`, `auth` as Proxy objects (same lazy init pattern).

Never import admin SDK in client components or vice versa. The lazy init is critical for Docker/Cloud Run — env vars aren't available at build time.

### API routes

RESTful pattern under `src/app/api/`. Each route uses `adminDb` for Firestore access and returns `NextResponse.json()`. Timestamps are converted from Firestore `Timestamp` to ISO strings in all GET responses.

Auth is per-route: Telegram webhook checks `x-telegram-bot-api-secret-token` header, cron and telegram setup check `Authorization: Bearer {CRON_SECRET}`, admin API routes require Firebase ID token via `verifyAdminAuth`.

### Magic login

Owner can access admin panel directly from Telegram without password. Flow: `/start` in bot → generates one-time token in `magicTokens` Firestore collection (5-min expiry) → inline button links to `/admin/login?token={token}` → login page exchanges token for Firebase custom token via `/api/auth/magic-token` → auto-signs in.

### Mobile responsive

Admin uses hamburger menu with slide-out drawer on mobile (`<md` breakpoint). Desktop keeps fixed sidebar. Calendar grid adapts: 2→4→7 columns. Clients page shows card list on mobile, table on desktop.

### Telegram bot flow

Webhook at `POST /api/telegram/webhook` dispatches to `src/lib/telegram/handlers.ts`. Main flows:

1. **Confirmation flow** — Client books via web → gets link to bot → `/start {appointmentId}` deep link → Confirm/Cancel inline buttons → updates Firestore + Calendar.
2. **Booking flow** — `/book` command → state machine stored in `bookingSessions` Firestore collection (awaiting_name → awaiting_phone → awaiting_date → awaiting_time) → creates appointment directly. Returning users (matched by `telegramChatId`) skip name/phone steps.
3. **Client commands** — `/my_appointments` (list upcoming), `/cancel` (cancel menu with inline buttons).
4. **Owner commands** — `/today` (day overview with times, names, phones, notes), `/admin_cancel` (cancel any upcoming appointment, notifies client). Owner is identified by `ownerTelegramChatId` in `businessConfig/main`.

Bot menu commands are registered in Ukrainian via `setMyCommands` API. Setup endpoint: `POST /api/telegram/setup` (requires `CRON_SECRET` auth).

All bot messages are localized via `src/lib/telegram/messages.ts`. Cancel notifications: `src/lib/telegram/notifications.ts` handles bidirectional notifications (owner→client, client→owner).

### Google Calendar sync

Service account auth via `googleapis` JWT. Color coding: orange (colorId "6") = booked, green (colorId "10") = confirmed. Calendar event IDs stored on appointment documents for bidirectional reference. `src/lib/calendar/google.ts` wraps all Calendar API calls.

### Slot calculation

`src/lib/slots.ts` — `getAvailableSlots(date, config, existingAppointments, now?)` computes free time slots from working hours minus existing bookings, break slots, and past times. The optional `now` parameter filters out slots that have already passed today. Used by the web API (`/api/appointments/slots`), Telegram bot handlers, and booking POST validation.

### Client calendar links

`src/lib/calendar/client-links.ts` generates `.ics` files (with VALARM reminders at 24h and 2h) and Google Calendar URLs. Sent via Telegram after confirmation and available on the booking success page.

### Cron reminders

External cron service (cron-job.org) hits `GET /api/cron/reminders` every 10 minutes with `Authorization: Bearer {CRON_SECRET}`. Queries for appointments needing 24h or 2h reminders, sends via Telegram, marks flags as sent. Also cleans expired `bookingSessions`. Update the URL in cron-job.org to the GCP service URL.

## Data model (Firestore)

- `businessConfig/main` — singleton with working hours, service name, duration, timezone
- `clients/{id}` — name, phone (required), consent metadata, appointment counters (total/confirmed/cancelled/noShow)
- `appointments/{id}` — clientId, dateTime, status, source, googleCalendarEventId, reminder flags
- `bookingSessions/{chatId}` — temporary Telegram booking state (auto-deleted on completion)
- `magicTokens/{token}` — one-time login tokens for owner Telegram→admin access (5-min expiry)

Appointment statuses: `booked` → `confirmed` → `completed` | `cancelled` | `no_show`.

### Known issues

- Booking form inputs not disabled during submission (allows double-submit) — fix in P9.
- Root `<html>` element missing `lang` attribute.
- `verifyAdminAuth` accepts any valid Firebase user, not just the owner.
- Cron-job.org URL still points to Vercel — update to GCP URL.
- New Firestore index `(clientId, dateTime DESC)` added to `firestore.indexes.json` but must be deployed: `firebase deploy --only firestore:indexes --project scheduler-56e1a`.

## Next.js 16 notice

@AGENTS.md — This project uses Next.js 16 which has breaking changes from training data. Check `node_modules/next/dist/docs/` for current API docs. The `middleware` convention is deprecated in favor of `proxy` (warning is expected during build).
