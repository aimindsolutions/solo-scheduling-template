# Infrastructure Setup Guide

Step-by-step guide to configure all external services needed to run the project.

---

## 1. Firebase Project

### Create project
1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click "Add project" → name it (e.g., `solo-scheduling`)
3. Disable Google Analytics (not needed)
4. Wait for project creation

### Enable Firestore
1. In Firebase Console → Build → Firestore Database
2. Click "Create database"
3. Start in **production mode** (we'll add security rules in step 6)
4. Choose region: **us-central1** (required for Firebase free Spark tier)

### Enable Authentication
1. Build → Authentication → Get started
2. Sign-in method tab:
   - Enable **Email/Password**
   - Enable **Google** (add your support email)
3. Create your admin account:
   - Users tab → Add user → enter your email and password

### Get client config (for `.env.local`)
1. Project settings (gear icon) → General → Your apps
2. Click web icon `</>` → Register app (name: "web")
3. Copy the config values:
   ```
   NEXT_PUBLIC_FIREBASE_API_KEY=...
   NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=...
   NEXT_PUBLIC_FIREBASE_PROJECT_ID=...
   NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=...
   NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...
   NEXT_PUBLIC_FIREBASE_APP_ID=...
   ```

### Get admin credentials (for `.env.local`)
1. Project settings → Service accounts
2. Click "Generate new private key" → download JSON
3. From the JSON file, extract:
   ```
   FIREBASE_PROJECT_ID=...        # "project_id"
   FIREBASE_CLIENT_EMAIL=...      # "client_email"
   FIREBASE_PRIVATE_KEY="..."     # "private_key" (keep the quotes, includes \n)
   ```

### Initial Firestore data
Create the business config document manually in Firestore Console:
- Collection: `businessConfig` → Document ID: `main`
- Fields:
  ```json
  {
    "businessName": "Your Business Name",
    "serviceName": "Consultation",
    "defaultDurationMinutes": 30,
    "timezone": "Europe/Kyiv",
    "jurisdiction": "UA",
    "languages": ["uk", "en"],
    "ownerEmail": "your@email.com",
    "workingHours": {
      "monday": { "start": "09:00", "end": "18:00" },
      "tuesday": { "start": "09:00", "end": "18:00" },
      "wednesday": { "start": "09:00", "end": "18:00" },
      "thursday": { "start": "09:00", "end": "18:00" },
      "friday": { "start": "09:00", "end": "17:00" },
      "saturday": null,
      "sunday": null
    },
    "breakSlots": [{ "start": "13:00", "end": "14:00" }]
  }
  ```

---

## 2. Telegram Bot

### Create bot
1. Open Telegram and message [@BotFather](https://t.me/BotFather)
2. Send `/newbot`
3. Choose a display name (e.g., "My Clinic Bot")
4. Choose a username (must end in `bot`, e.g., `my_clinic_scheduling_bot`)
5. Copy the **HTTP API token** → `TELEGRAM_BOT_TOKEN`
6. The username (without @) → `TELEGRAM_BOT_USERNAME`

### Configure bot
Send these commands to @BotFather:
```
/setcommands
```
Then select your bot and send:
```
book - Book an appointment
my_appointments - View my appointments
cancel - Cancel an appointment
```

### Set webhook (after deployment)
Once deployed to Vercel, register the webhook:
```bash
curl -X POST "https://api.telegram.org/bot<YOUR_TOKEN>/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://your-domain.vercel.app/api/telegram/webhook",
    "secret_token": "<YOUR_WEBHOOK_SECRET>",
    "allowed_updates": ["message", "callback_query"]
  }'
```

Generate a random webhook secret:
```bash
openssl rand -hex 32
```
Save it as `TELEGRAM_WEBHOOK_SECRET` in `.env.local` and Vercel env vars.

---

## 3. Google Calendar API

### Enable API
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select the same project as Firebase (or create one)
3. APIs & Services → Library → search "Google Calendar API" → Enable

### Create service account
1. APIs & Services → Credentials → Create credentials → Service account
2. Name: `calendar-sync`, Role: none needed
3. Click the created service account → Keys tab → Add key → JSON
4. Download the JSON key file
5. Extract for `.env.local`:
   ```
   GOOGLE_SERVICE_ACCOUNT_EMAIL=...  # "client_email" from JSON
   GOOGLE_PRIVATE_KEY="..."          # "private_key" from JSON
   ```

### Share calendar with service account
1. Open [Google Calendar](https://calendar.google.com/)
2. Create a new calendar for appointments (or use existing)
3. Calendar settings → Share with specific people → Add the service account email
4. Permission: **Make changes to events**
5. Copy the Calendar ID (Settings → Integrate calendar → Calendar ID):
   ```
   GOOGLE_CALENDAR_ID=...
   ```
   (Usually looks like `abc123@group.calendar.google.com` or `primary`)

---

## 4. Environment Variables

Copy `.env.local.example` to `.env.local` and fill in all values:

```bash
cp .env.local.example .env.local
```

### Generate secrets
```bash
# Cron secret (for Vercel cron auth)
openssl rand -hex 32

# Telegram webhook secret
openssl rand -hex 32
```

### Complete `.env.local`
```env
# Firebase Client
NEXT_PUBLIC_FIREBASE_API_KEY=...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=...
NEXT_PUBLIC_FIREBASE_PROJECT_ID=...
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=...
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...
NEXT_PUBLIC_FIREBASE_APP_ID=...

# Firebase Admin
FIREBASE_PROJECT_ID=...
FIREBASE_CLIENT_EMAIL=...
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"

# Google Calendar
GOOGLE_CALENDAR_ID=...
GOOGLE_SERVICE_ACCOUNT_EMAIL=...
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"

# Telegram
TELEGRAM_BOT_TOKEN=...
TELEGRAM_BOT_USERNAME=my_clinic_scheduling_bot
TELEGRAM_WEBHOOK_SECRET=...

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
CRON_SECRET=...
```

---

## 5. Vercel Deployment

### Deploy
1. Push code to GitHub
2. Go to [Vercel](https://vercel.com/) → Import repository
3. Framework: Next.js (auto-detected)
4. Add all environment variables from `.env.local`
   - Change `NEXT_PUBLIC_APP_URL` to your Vercel domain
5. Deploy

### Post-deployment
1. **Register Telegram webhook** (see section 2 above) — use the production URL
2. **Set up external cron** (see section 5b below) — Vercel free tier only supports daily cron
3. **Test booking** — visit your-domain.vercel.app, book an appointment
4. **Test Telegram** — open bot, send /start, confirm appointment

---

## 5b. External Cron Service (free tier workaround)

Vercel's free Hobby tier limits cron jobs to **once per day**. The reminder system needs to run every 10 minutes. Use a free external cron service instead.

### Option A: cron-job.org (recommended)
1. Sign up at [cron-job.org](https://cron-job.org/) (free tier: unlimited jobs, 1-min intervals)
2. Create a new cron job:
   - **URL:** `https://your-domain.vercel.app/api/cron/reminders`
   - **Schedule:** Every 10 minutes (`*/10 * * * *`)
   - **Request method:** GET
   - **Headers:** add `Authorization: Bearer <YOUR_CRON_SECRET>`
3. Enable and save

### Option B: UptimeRobot
1. Sign up at [uptimerobot.com](https://uptimerobot.com/) (free tier: 5-min minimum interval)
2. Add new monitor → HTTP(s) → type the URL
3. Set check interval to 5 minutes (closest to 10-min available on free tier)
4. Add custom HTTP header: `Authorization: Bearer <YOUR_CRON_SECRET>`

### Remove Vercel cron config
Since we're using an external service, remove or comment out the cron config in `vercel.json` to avoid confusion.

---

## 6. Firestore Security Rules

Deploy these rules in Firebase Console → Firestore → Rules:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Public read for business config (needed for slot calculation)
    match /businessConfig/{doc} {
      allow read: if true;
      allow write: if request.auth != null;
    }

    // Clients — server-side only (via Admin SDK)
    match /clients/{clientId} {
      allow read, write: if false;
    }

    // Appointments — server-side only (via Admin SDK)
    match /appointments/{appointmentId} {
      allow read, write: if false;
    }

    // Booking sessions — server-side only
    match /bookingSessions/{sessionId} {
      allow read, write: if false;
    }
  }
}
```

Note: All data access goes through API routes using the Admin SDK, which bypasses security rules. The rules above lock down direct client-side access.
