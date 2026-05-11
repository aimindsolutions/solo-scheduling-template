# Implementation Plan: Solo Service Business Scheduling Template

## Context

Build a scheduling template for solo service businesses (doctors, dentists, manicure, etc.) targeting the Ukrainian market first (UA + EN languages). The system allows clients to book appointments via a landing page or Telegram bot, with Telegram-based confirmations and reminders, Google Calendar sync, and an admin dashboard for the business owner.

**Key decisions made:**
- Next.js 15+ App Router + shadcn/ui + Tailwind CSS
- Firebase Auth (email/password + Google SSO) for admin
- Firestore as primary data store
- Vercel for frontend deployment, Firebase/GCP for backend
- Both landing page booking and Telegram bot booking from the start
- Configurable appointment duration
- Ukraine (UA, EN) as first deployment target

---

## Architecture

```
┌─────────────────────────────────┐
│      Vercel (Frontend)          │
│  Next.js App Router             │
│  ┌───────────┐ ┌──────────────┐ │
│  │ Landing   │ │ Admin        │ │
│  │ Page +    │ │ Dashboard    │ │
│  │ Booking   │ │ (Protected)  │ │
│  └───────────┘ └──────────────┘ │
│  ┌───────────────────────────┐  │
│  │ API Routes (Next.js)      │  │
│  │ /api/appointments         │  │
│  │ /api/telegram/webhook     │  │
│  │ /api/reminders/check      │  │
│  └───────────────────────────┘  │
└─────────────┬───────────────────┘
              │
    ┌─────────┴─────────┐
    │                   │
┌───▼───┐  ┌────────────▼────────────┐
│Firestore│  │ External APIs           │
│(Data)  │  │ - Telegram Bot API      │
│        │  │ - Google Calendar API   │
└────────┘  └─────────────────────────┘
```

**Why Next.js API Routes instead of Cloud Functions:** For an MVP with low traffic (single solo business), Next.js API routes on Vercel are simpler to develop, deploy, and maintain. Cloud Functions can be adopted later if needed for scale or background processing. The reminder cron uses Vercel Cron Jobs.

---

## Cross-Cutting Feature: "Add to Client Calendar"

Every client-facing touchpoint includes a universal link/file for clients to save the appointment to their own device calendar (Google Calendar, Apple Calendar, Outlook, etc.).

### Implementation (`src/lib/calendar/client-links.ts`)

1. **`.ics` file generation** — standard iCalendar format file containing:
   - Event title (service name from businessConfig)
   - Start/end time (appointment dateTime + duration)
   - Location (if configured)
   - Reminder alarms: 24h and 2h before (built into the `.ics` so the client's device calendar sends native reminders)
   - Works universally: Apple Calendar, Google Calendar, Outlook, Samsung Calendar, etc.

2. **Google Calendar URL** — direct link: `https://calendar.google.com/calendar/render?action=TEMPLATE&text=...&dates=...`
   - No API needed, opens Google Calendar with pre-filled event
   - Useful for Android/Chrome users

### Where it appears:

| Touchpoint | How |
|---|---|
| **Booking success page** | "Add to Calendar" button → dropdown with Google Calendar link + `.ics` download |
| **Telegram confirmation** (after client confirms) | `.ics` sent as file attachment + Google Calendar link as inline button |
| **Telegram direct booking** (after bot booking) | Same: `.ics` attachment + Google Calendar link |
| **Telegram reminders** (24h and 2h) | Google Calendar link as inline button (quick "add if you haven't yet") |
| **Email** (if client provided email) | Both links in the email body |

### `.ics` reminder alarms

The generated `.ics` file includes two `VALARM` components:
- 24 hours before → device notification
- 2 hours before → device notification

This means clients get **native device reminders** from their own calendar app, in addition to the Telegram reminders from the system. Double coverage for reducing no-shows.

---

## Project Structure

```
src/
├── app/
│   ├── [locale]/                  # i18n: /uk/..., /en/...
│   │   ├── page.tsx               # Landing page
│   │   ├── book/
│   │   │   ├── page.tsx           # Booking form
│   │   │   └── success/page.tsx   # Post-booking + Telegram link
│   │   └── layout.tsx             # Public layout with lang switcher
│   ├── admin/                     # No locale prefix for admin
│   │   ├── layout.tsx             # Auth guard
│   │   ├── page.tsx               # Dashboard (today's appointments)
│   │   ├── calendar/page.tsx      # Calendar view
│   │   ├── clients/
│   │   │   ├── page.tsx           # Client list
│   │   │   └── [id]/page.tsx      # Client detail + history
│   │   └── settings/page.tsx      # Business config
│   ├── api/
│   │   ├── appointments/
│   │   │   ├── route.ts           # POST create, GET list
│   │   │   ├── [id]/route.ts      # PATCH update, DELETE
│   │   │   ├── [id]/calendar/     # .ics and Google Calendar links
│   │   │   └── slots/route.ts     # GET available time slots
│   │   ├── clients/
│   │   │   ├── route.ts           # GET list, POST create
│   │   │   └── [id]/route.ts      # GET detail, PATCH update
│   │   ├── config/route.ts        # GET/PUT business configuration
│   │   ├── telegram/
│   │   │   └── webhook/route.ts   # Telegram webhook handler
│   │   ├── calendar/
│   │   │   └── sync/route.ts      # Calendar sync endpoint
│   │   └── cron/
│   │       └── reminders/route.ts # Vercel Cron — reminder check
│   └── layout.tsx                 # Root layout
├── components/
│   ├── ui/                        # shadcn/ui components
│   ├── booking/                   # Booking form components
│   ├── admin/                     # Admin dashboard components
│   └── shared/                    # Language switcher, etc.
├── lib/
│   ├── firebase/
│   │   ├── admin.ts               # Firebase Admin SDK init
│   │   ├── client.ts              # Firebase client SDK init
│   │   └── auth.ts                # Auth helpers
│   ├── telegram/
│   │   ├── bot.ts                 # Telegram Bot API wrapper
│   │   ├── handlers.ts            # Command & callback handlers
│   │   └── messages.ts            # Message templates (localized)
│   ├── calendar/
│   │   ├── google.ts              # Google Calendar API wrapper
│   │   └── client-links.ts        # .ics generator + Google Calendar URL builder
│   ├── email/
│   │   └── send.ts                # Email sending (optional)
│   ├── slots.ts                   # Available slots calculation
│   └── validators.ts              # Phone, form validation
├── types/
│   └── index.ts                   # TypeScript interfaces
└── i18n/
    ├── config.ts                  # next-intl config
    ├── routing.ts                 # Locale routing definition
    ├── request.ts                 # Server-side i18n loader
    ├── navigation.ts              # i18n-aware Link, useRouter
    └── messages/
        ├── uk.json                # Ukrainian translations
        └── en.json                # English translations
```

---

## Firestore Data Model

### `businessConfig` (single document: "main")

```typescript
{
  businessName: string;
  serviceName: string;
  defaultDurationMinutes: number;      // configurable by owner
  workingHours: {
    [day: string]: { start: string; end: string } | null; // null = day off
  };
  breakSlots: { start: string; end: string }[];  // lunch, etc.
  ownerEmail: string;
  googleCalendarId: string;
  timezone: string;                     // e.g., "Europe/Kyiv"
  languages: string[];                  // ["uk", "en"]
  jurisdiction: "UA" | "BG";
}
```

### `clients/{clientId}`

```typescript
{
  firstName: string;                    // required
  lastName?: string;
  phone: string;                        // required, validated
  email?: string;
  telegramChatId?: string;             // linked when client starts bot
  language?: string;                    // preferred language
  consentGiven: boolean;
  consentTimestamp: Timestamp;
  consentLanguage: string;
  consentJurisdiction: "UA" | "BG";
  totalAppointments: number;
  confirmedAppointments: number;
  cancelledAppointments: number;
  noShowAppointments: number;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

### `appointments/{appointmentId}`

```typescript
{
  clientId: string;                     // ref to clients collection
  clientName: string;                   // denormalized for quick display
  clientPhone: string;                  // denormalized
  dateTime: Timestamp;                  // appointment start
  durationMinutes: number;
  status: "booked" | "confirmed" | "cancelled" | "completed" | "no_show";
  source: "web" | "telegram" | "admin"; // how it was created
  googleCalendarEventId?: string;
  reminder24hSent: boolean;
  reminder2hSent: boolean;
  notes?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

### `bookingSessions/{chatId}` (temporary)

```typescript
{
  step: "awaiting_name" | "awaiting_phone" | "awaiting_date" | "awaiting_time";
  name: string;
  phone: string;
  selectedDate?: string;
  chatId: number;
  lang: string;
  createdAt: Timestamp;
}
```

---

## Implementation Phases

### Phase 0: Project Scaffold & Infrastructure Setup ✅
**Files:** project root configs, `src/lib/firebase/`, `src/types/`, `src/i18n/`

1. Initialize Next.js project with TypeScript, App Router
2. Install and configure Tailwind CSS + shadcn/ui
3. Set up next-intl for i18n (UK, EN) with `[locale]` routing
4. Create Firebase project (Firestore, Auth)
5. Initialize Firebase Admin SDK + client SDK
6. Create Telegram bot via BotFather
7. Enable Google Calendar API + create service account
8. Set up environment variables (`.env.local` template)
9. Define TypeScript interfaces for all data models
10. Write Firestore security rules

**Deliverable:** Project runs locally, Firebase connected, env vars documented.

---

### Phase 1: Landing Page & Booking Form ✅
**Files:** `src/app/[locale]/page.tsx`, `src/app/[locale]/book/`, `src/components/booking/`, `src/lib/slots.ts`, `src/lib/validators.ts`

1. Landing page with hero section, CTA, language switcher (UK/EN), responsive mobile-first
2. Booking form: date picker, time slot selector, form fields (first name*, last name, phone*, email, notes), consent checkbox
3. Available slots logic: working hours, existing appointments, break slots, configurable duration
4. API route `POST /api/appointments`: validate, create client, create appointment, create Calendar event (orange)
5. Success page: appointment summary, Telegram bot link, **"Add to Calendar" button** (Google Calendar + `.ics` download with device reminders)
6. Email confirmation (if email provided): appointment details, Telegram link, calendar links

**Deliverable:** Client can book via web form, appointment appears in Firestore + Calendar, client can save to their own calendar.

---

### Phase 2: Telegram Bot — Confirmation & Linking ✅
**Files:** `src/app/api/telegram/webhook/route.ts`, `src/lib/telegram/`

1. Telegram webhook endpoint with secret token validation
2. `/start` command with deep linking (client reference → link `chat_id`)
3. Confirmation message after booking with inline buttons [Confirm] [Cancel]
4. Confirm callback: update Firestore → confirmed, Calendar → green, send `.ics` + Google Calendar link
5. Cancel callback: update Firestore → cancelled, delete Calendar event
6. All messages localized (UK/EN)

**Deliverable:** Full confirmation flow via Telegram working end-to-end.

---

### Phase 3: Telegram Bot — Direct Booking Flow ✅
**Files:** `src/lib/telegram/handlers.ts`, `src/lib/telegram/messages.ts`

1. Bot conversation: `/book` → name → phone (share button) → date selection → time selection → confirm
2. State machine via `bookingSessions` Firestore collection
3. On confirmation: create client, create appointment (confirmed immediately), Calendar (green), send `.ics` + Google Calendar link
4. `/my_appointments` — list upcoming, `/cancel` — cancel upcoming
5. Consent prompt on first interaction

**Deliverable:** Clients can book entirely through Telegram bot.

---

### Phase 4: Reminders System ✅
**Files:** `src/app/api/cron/reminders/route.ts`, `vercel.json`

1. Vercel Cron every 10 minutes → `GET /api/cron/reminders` with Bearer token auth
2. Query confirmed appointments needing 24h or 2h reminders
3. Send Telegram reminder with cancel button + Google Calendar link
4. Mark reminder flags as sent in Firestore

**Deliverable:** Automated reminders at 24h and 2h before appointment, with calendar save option.

---

### Phase 5: Admin Dashboard — Core ✅
**Files:** `src/app/admin/`, `src/components/admin/`

1. Firebase Auth: email/password + Google SSO, login page, auth guard layout
2. Dashboard home: today's appointments, quick stats (total/confirmed/pending)
3. Calendar view: week navigation, color-coded appointments, click to view
4. Client list: searchable table, reliability badges
5. Client detail: contact info, appointment history, statistics

**Deliverable:** Owner can view and manage all appointments and clients.

---

### Phase 6: Admin Dashboard — Management Features ✅
**Files:** `src/app/admin/settings/`, `src/app/api/config/`

1. Settings page: business name, service name, duration (configurable), working hours per day, break slots, timezone
2. Create/edit/cancel appointments from admin with Calendar + Telegram notifications
3. No-show handling: mark completed/no-show, update client stats

**Deliverable:** Full CRUD for appointments, business configuration editable.

---

### Phase 7: Google Calendar Two-Way Sync ✅
**Files:** `src/lib/calendar/google.ts`, `src/app/api/calendar/sync/route.ts`

1. App → Calendar sync in Phases 1-3 (create/confirm/delete events)
2. Calendar → Firestore import: poll Calendar events, create appointments for untracked events
3. Conflict resolution: Firestore is source of truth

**Deliverable:** Owner can create events in Google Calendar and see them in the dashboard.

---

### Phase 8: Polish, Testing & Deployment
**Files:** various, `vercel.json`, docs

1. Responsive design audit (mobile, tablet, desktop)
2. Loading states, error boundaries, toast notifications
3. Form validation edge cases
4. i18n completeness check
5. Privacy policy page
6. Vercel deployment (env vars, cron, domain)
7. Firestore security rules
8. Telegram webhook registration
9. Setup documentation

**Deliverable:** Production-ready deployment with documentation.

---

## Verification Plan

| Phase | How to verify |
|---|---|
| 0 | `npm run dev` starts, Firebase connection works |
| 1 | Book via form → appears in Firestore + Calendar (orange) |
| 2 | Telegram bot link → start → confirm → Calendar green, Firestore confirmed |
| 3 | Bot `/book` → full flow → appointment created |
| 4 | Create appointment 2h out → receive Telegram reminder |
| 5 | Admin login → see appointments, calendar, clients |
| 6 | Admin create/edit/cancel, change settings |
| 7 | Create event in Google Calendar → appears in dashboard |
| 8 | Full end-to-end on production URL, mobile check |

---

## Key Dependencies

- `next`, `react`, `react-dom` — framework
- `tailwindcss`, shadcn/ui components — styling
- `next-intl` — internationalization
- `firebase` (client), `firebase-admin` (server) — data & auth
- `googleapis` — Google Calendar API
- `zod` — validation
- `date-fns` — date manipulation
- `ical-generator` — `.ics` file generation with VALARM reminders
- `lucide-react` — icons
