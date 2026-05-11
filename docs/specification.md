# Solo Service Business Scheduling Template – Updated Specification

## 1. Scope Update

This version refines the previous specification based on updated decisions:

- Only **Telegram** is implemented initially as the messaging channel; other messengers (Viber, SMS, WhatsApp) remain future options.
- **Google Sheets integration is removed**; no duplication of client data into Sheets. All operational data is in Firestore.
- Firestore is the **primary source of truth**; Google Calendar is a synchronized view.
- Owner accesses data exclusively via the **admin web dashboard** and Google Calendar.
- Client does **not choose a service type**; each project is dedicated to a single business type (e.g., doctor, dentist, manicure).
- Required client fields are **Name** and **Phone**; email and other fields are optional.
- Telegram is the **main channel for confirmations**; reminder schedule is fixed at **24 hours and 2 hours** before the appointment.
- Retention policy and long‑term storage details will be decided later and remain explicit **open questions**.


## 2. Client Data and Consent

### 2.1 Client data fields

For each appointment booking, the client form collects:

- First name (required).
- Last name (optional).
- Phone number (required; validated as a phone number).
- Email (optional).
- Optional notes or message (configurable).

This aligns with a data‑minimization approach often recommended under GDPR and national data‑protection frameworks, as only necessary contact details for scheduling and reminders are collected.[^1][^2]

### 2.2 Consent checkbox

- Mandatory checkbox; unchecked by default.
- Text states that data is stored and used only for managing appointments and reminders and refers to the Privacy Policy.
- Consent is stored in Firestore along with timestamp, language, and jurisdiction (BG/UA).

Example (to be localized):

> "I agree that my name, phone number, email and appointment details will be stored and used only for managing my visits and sending reminders, according to the Privacy Policy."

Electronic consent via checkbox satisfies the requirement for explicit, informed consent for personal data processing under GDPR (BG) and the Ukrainian personal data protection law when combined with proper information notices.[^2][^3][^1]


## 3. Business Model and Services

### 3.1 Single‑service per deployment

- Each project is bound to **one owner and one service type**:
  - If owner is a doctor or dentist: appointment is implicitly “doctor visit” / “dental visit”.
  - If owner is a manicure master: appointment is “manicure service”.
- Client **does not choose among multiple services** during booking.
- Service metadata (name, default duration) is part of business configuration, not user input.

### 3.2 Reuse for other solo businesses

- To reuse the template for another business, change configuration only:
  - Business name and branding.
  - Service name and default duration.
  - Language set (see section 6).
- No structural changes in data model or flows are required.


## 4. Messaging and Confirmation Flows (Telegram‑first)

### 4.1 Rationale for Telegram priority

- Telegram usage is high in Ukraine and present in Bulgaria, especially among younger, more digital‑native users, making it a practical first channel for confirmations.[^4]
- Telegram bots are easy to integrate via HTTPS APIs and widely used for automation and scheduling workflows.[^5][^6]
- Viber remains extremely popular in BG and UA, but its business API involves more onboarding and commercial setup; it is reserved for later phases.[^7][^8][^9]

### 4.2 Client booking via landing page (with Telegram confirmation)

Flow:

1. Client visits landing page and fills basic form (date, time, name, phone, optional email, consent).
2. System creates appointment in Firestore with status `booked` and creates a provisional Google Calendar event with orange colour ("not yet confirmed").[^10][^11]
3. System tries to connect with client over Telegram:
   - If client previously linked their Telegram account, system sends a confirmation message via bot.
   - If not, the confirmation page shows a link to the Telegram bot (`https://t.me/<botname>`) with instructions to press **Start**; once the bot receives the initial message, the backend associates client with Telegram `chat_id` and sends confirmation message.
4. Confirmation message:
   - Text: "You booked an appointment on [date/time]. Please confirm or cancel."
   - Inline buttons: **Confirm** / **Cancel**.
5. Client taps **Confirm**:
   - Firestore appointment status changes to `confirmed`.
   - Google Calendar event colour updated to green (confirmed).
6. Client taps **Cancel**:
   - Appointment status changes to `cancelled`.
   - Google Calendar event is deleted.

This pattern corresponds to scheduling best practices where the chat bot acts as a conversational front‑end for confirmation and changes while the underlying booking logic and calendar remain in the backend.[^12][^13]

### 4.3 Client booking directly via Telegram bot UI

Alternative or additional flow, optimised for markets where Telegram is the primary channel (especially UA):

1. Client starts the owner’s Telegram bot.
2. Bot asks for minimal data:
   - First name (or uses Telegram profile name).
   - Phone number (via Telegram’s “share phone number” button where available).
   - Preferred date/time.
3. Bot calls backend API to create a tentative appointment in Firestore and Calendar (orange event).
4. Bot confirms back: "Appointment created for [date/time]." and sets status to `confirmed` immediately, unless the design keeps two‑step confirmation.

This option is particularly natural in Ukraine and other Telegram‑heavy markets, where bots are already widely used to manage bookings and notifications.[^5][^4]

### 4.4 Reminders (24h and 2h)

- Cloud Scheduler triggers Cloud Run endpoint every 5 or 10 minutes.
- For each appointment:
  - 24‑hour reminder if appointment is confirmed and `reminder24hSent=false`.
  - 2‑hour reminder if appointment is confirmed and `reminder2hSent=false`.
- Reminders are sent through Telegram if the client has a linked `chat_id`.
- If no Telegram link is available, the system currently has no automated reminder; later phases may add SMS/email fallback.

Reminder cadence at 24 hours and 2 hours is consistent with common appointment systems and recommended by scheduling best‑practice guides for reducing no‑shows.[^13][^12]


## 5. Owner Workflows and Statistics

### 5.1 Owner views and edits schedule

Owner capabilities remain as previously described, with access via:

- Admin web dashboard:
  - Today and upcoming appointments.
  - Calendar view of booked/free time.
  - Client list and histories.
- Google Calendar:
  - All appointments present as events.
  - Colour coding according to status:
    - Orange: booked, not confirmed.
    - Green: confirmed.

### 5.2 Owner records additional appointments

Owner can create appointments via:

- Admin web calendar: click free slot, assign to an existing or new client.
- Google Calendar: create event; backend syncs to Firestore.
- Telegram bot:
  - Owner chooses client.
  - Requests free slots for given day or range.
  - Bot returns list of free times based on Firestore/Calendar; owner taps to create.

### 5.3 Client reliability statistics

System records reliability characteristics in Firestore based on appointment statuses:

- Counters on `clients` document:
  - `totalAppointments`.
  - `confirmedAppointments`.
  - `cancelledAppointments`.
  - `noShowAppointments` (if later implemented).
- Rules:
  - Cancelled by client before time → increment `cancelledAppointments`.
  - Marked by owner as "didn't come" → increment `noShowAppointments`.
- Dashboard displays simple badges or indicators such as:
  - "Often cancels" (high cancel ratio).
  - "Usually on time" (high confirmed vs cancelled/no‑show ratio).

This supports behavioural insights without storing more sensitive information than necessary.


## 6. Frontend Hosting and Languages

### 6.1 Hosting options (Vercel vs Google)

- The template is compatible with:
  - **Vercel**: ideal for Next.js‑based frontends with automatic previews, strong developer ergonomics and global edge network for static/SSR content.[^14][^15][^16]
  - **Firebase Hosting** or other Google Cloud static hosting: more tightly coupled with Firebase backend and GCP billing, but less specialized around Next.js.[^15][^17]
- Specification requirement:
  - The template must build as a Next.js or React SPA that can be deployed either to Vercel or Firebase Hosting.
  - Choice of platform is made per deployment; documentation must include both options.

Vercel is often preferred for modern React/Next.js teams due to its deployment workflows, while Firebase Hosting is convenient when most services are already on Google Cloud.[^16][^14][^15]

### 6.2 Language selection

- For Bulgaria‑based deployments:
  - Supported UI languages: BG, EN, UA, RU.
- For Ukraine‑based deployments:
  - Supported UI languages: UA, EN.
- Language selection:
  - Landing page shows a language switcher.
  - Selected language is stored in client cookies/local storage and optionally appended to appointment record.
  - Consent text, UI labels, and messages from Telegram bot are all localized.

Internationalization is implemented via resource files and/or frameworks (e.g., `next-i18next` for Next.js).


## 7. Data Model Adjustments

### 7.1 Firestore (primary source of truth)

- Firestore collections remain:
  - `businessConfig`.
  - `clients/{clientId}`.
  - `appointments/{appointmentId}`.
  - Optional `statsDaily/{date}`.
- Client fields are adjusted to reflect required Name and Phone only; email and notes optional.
- Sheet‑related fields and logic are removed.

Firestore’s use as primary database continues to rely on documented quotas and limits appropriate for small projects using the free or low tiers of Firestore.[^18][^19]

### 7.2 Google Calendar synchronization

- On appointment create:
  - Create Calendar event with default colour for "unconfirmed" (orange).
- On status change to `confirmed`:
  - Update event colour to green.
- On status change to `cancelled`:
  - Delete event.

Google Calendar API supports creating events with custom colours and updating or deleting them, allowing the calendar view to visually reflect booking confirmation states.[^11][^10]


## 8. Open Questions (Explicitly Deferred)

The following design decisions are intentionally left open and must be defined during implementation or project onboarding per owner:

1. **Long‑term retention and deletion strategy**:
   - How long client and appointment records are kept.
   - Whether old appointments are anonymized or fully deleted.
   - Alignment with GDPR storage limitation principles and any local medical retention rules.
2. **Exact rules for no‑show detection**:
   - Whether owner must manually mark an appointment as no‑show.
   - Whether system infers no‑show based on time passed without status update.
3. **Future messaging channels**:
   - When and how to add Viber, SMS, and WhatsApp as secondary channels, especially given very high Viber penetration in BG/UA and strong Telegram usage in UA.[^8][^9][^7][^4]
4. **Whether clients should ever choose among multiple services** within a single‑owner deployment (e.g., different visit types for same doctor) or whether separate projects should be used.

These questions must be addressed before production deployment in order to finalize compliance documentation, UI flows, and data lifecycle policies.

---

## References

1. [Data protection laws in Ukraine](https://www.dlapiperdataprotection.com/index.html?t=law&c=UA) - Unambiguous consent of the personal data subject;; Cross-border transfer is needed to enter into or ...

2. [Data protection laws in Bulgaria](https://www.dlapiperdataprotection.com/index.html?t=law&c=BG) - The Personal Data Protection Act complements the GDPR by providing regulation to matters in the fiel...

3. [Personal Data Protection in Ukraine](https://www.cliffordchance.com/content/dam/cliffordchance/briefings/2013/12/personal-data-protection-in-ukraine.pdf) - The Ukrainian law definition of personal data is rather broad and includes. "any information related...

4. [Social Media Trends in Ukraine, Bulgaria & Romania](https://nationalsample.com/social-media-in-eastern-europe-how-digital-habits-are-changing-in-ukraine-bulgaria-and-romania/) - Social media trends in Ukraine are shifting, with Telegram and TikTok now ranking higher in populari...

5. [A complete guide to Telegram automations - CodeWords](https://codewords.ai/blog/a-complete-guide-to-telegram-automations) - Companies using Telegram automations report 68% faster response times, 40% fewer support tickets, an...

6. [Telegram Bot API](https://core.telegram.org/bots/api) - The Bot API is an HTTP-based interface created for developers keen on building bots for Telegram. To...

7. [Mass Messaging with Viber: Geo Penetration, Compliance ...](https://bsg.world/blog/about/mass-messaging-with-viber-geo-penetration-compliance-and-pricing-dynamics) - As of 2021, Viber held a 97.7% market share in Ukraine , and 20% of all the messages sent on the app...

8. [Viber Market: An In-Depth Look at Messenger Impact in Europe](https://messaggio.com/blog/viber-market-an-in-depth-look-at-messenger-impact-in-europe/) - Countries like Bulgaria, Greece, Ukraine have a strong Viber presence, with Ukraine alone accounting...

9. [Viber](https://en.wikipedia.org/wiki/Viber) - As of September 2021, Viber is Ukraine's most popular messaging app, with a market share of 97.7%. ....

10. [Integrating Google Calendar API in Node.JS: A Guide to ...](https://dev.to/the_rusty_dev/integrating-google-calendar-api-in-nodejs-a-guide-to-event-creation-and-meeting-scheduling-1d3l) - Google Calendar API is a powerful tool for managing events and scheduling meetings programmatically....

11. [Create events | Google Calendar](https://developers.google.com/workspace/calendar/api/guides/create-events) - To create an event, call the events.insert() method providing at least these parameters: event is th...

12. [Best Appointment Scheduling Options for Telegram Bot ...](https://www.nitroclaw.com/learn/appointment-scheduling-compare-telegram-bot-builders) - *Choose a scheduler with webhooks or API access if your Telegram bot needs to confirm, modify, or ca...

13. [How to Efficiently Use a Chatbot for Scheduling](https://hellotars.com/blog/how-to-efficiently-use-a-chatbot-for-scheduling-explore-benefits-and-best-practices) - How to Efficiently Use a Chatbot for Scheduling – Explore Benefits and Best Practices · 1. Improved ...

14. [Firebase vs Vercel: Backend Platform vs Frontend Host](https://www.buildmvpfast.com/compare/firebase-vs-vercel) - Firebase is a backend service with database and auth. Vercel is a hosting platform for Next.js. Lear...

15. [Vercel vs Firebase (2026): Features, Pricing, and Key ...](https://uibakery.io/blog/vercel-vs-firebase) - Vercel focuses mainly on frontend hosting and serverless edge functions, while Firebase provides ful...

16. [Firebase Hosting vs Netlify vs Vercel: Which Platform Is ...](https://startupik.com/firebase-hosting-vs-netlify-vs-vercel-which-platform-is-better/) - The short version: Vercel is usually strongest for modern frontend teams using Next.js, Netlify is o...

17. [Firebase vs Vercel](https://bejamas.com/compare/firebase-vs-vercel) - Compare Firebase vs Vercel and choose the best tool for your project.

18. [Usage and limits | Firestore - Firebase - Google](https://firebase.google.com/docs/firestore/quotas) - Cloud Firestore offers free quota that lets you get started at no cost. If you need more quota, you ...

19. [Quotas and limits | Firestore in Native mode](https://docs.cloud.google.com/firestore/quotas) - The free tier amounts are listed in the following table. Free tier amounts are applied daily and res...

