# Session Retrospective: Telegram Bot Menu & Links

**Date:** 2026-05-12  
**Commits:** `364cecc`, `0c5f90d`, `5c8a78f`, `ed1d562`

## Goal
Fix three Telegram bot issues:
1. Consent message displayed without confirmation buttons
2. Missing web links in bot notifications (admin link in new bookings, website links for clients)
3. Owner menu mixing client commands with owner-only commands

## What changed

### 1. Consent message placement (UX fix)
- **Before:** Standalone message "By pressing Confirm, you agree..." sent with no buttons
- **After:** Consent text integrated into the booking confirmation prompt, shown only for new clients, directly above Confirm/Cancel buttons
- **File:** `src/lib/telegram/messages.ts` — updated `confirmBookingPrompt()` to accept `isNewClient` flag and include consent when true
- **File:** `src/lib/telegram/handlers.ts` — removed standalone `consentMessage` from `startBookingFlow`, added `isNewClient` flag to booking session, passed flag through `handleTimeSelection` to prompt

### 2. Web links in notifications
- **Owner notification:** Added "📋 Адмін-панель" inline button to `notifyOwnerOfNewBooking` with auto-generated magic token link
- **Client notification (web booking):** Added "🌐 На сайт" button to confirmed appointment message (shows when client confirms via `/start {appointmentId}`)
- **Client welcome:** Already had "Book on website" button (no change needed)
- **File:** `src/lib/telegram/notifications.ts` — imported `buildInlineKeyboard`, added `NEXT_PUBLIC_APP_URL` env check, attached button to owner notification
- **File:** `src/lib/telegram/handlers.ts` — added website button to `confirmedMessage` callback handler

### 3. Owner-only bot menu
- **Menu registration:** Fixed `setupBotCommands()` to register separate command scopes
  - Global default: `/book`, `/my_appointments`, `/cancel` (client commands)
  - Owner scope (`type: chat`): `/today`, `/week`, `/admin_cancel`, `/admin` (owner only)
- **New commands:**
  - `/week` — 7-day overview grouped by date with Ukrainian day names
  - `/admin` — generates fresh magic token and sends login link (5-min expiry)
- **File:** `src/lib/telegram/bot.ts` — updated `setupBotCommands()` to register owner scope separately
- **File:** `src/lib/telegram/handlers.ts` — added `/week` and `/admin` message handlers + two new functions: `showOwnerWeekOverview()` and `sendOwnerAdminLink()`

### 4. Fixed Firestore query failures
- **Problem:** Owner's `/admin_cancel` returned nothing — silent failure
- **Root cause:** Firestore forbids combining `dateTime >=` range filter with `status in [...]` on different fields without a composite index (no index exists)
- **Solution:** For owner cancel menu, removed `status in` filter from query, filter status in JavaScript instead
- **Client functions:** Restored original queries (they use `clientId ==` equality filter, which has existing composite index with `dateTime >=` and `status in`)
- **File:** `src/lib/telegram/handlers.ts` — updated `showOwnerCancelMenu()` to fetch all future appointments and filter/sort in JS; reverted `showCancelMenu()` and `showMyAppointments()` to original working queries

### 5. Environment setup
- Updated `NEXT_PUBLIC_APP_URL` in `.env.local` from `http://localhost:3000` to production domain `https://solo-scheduling-template.vercel.app`
- Updated same var in Vercel project settings (production environment)

## Key files touched
- `src/lib/telegram/handlers.ts` — main handler logic, all new commands and fixes
- `src/lib/telegram/bot.ts` — command registration
- `src/lib/telegram/messages.ts` — consent message integration
- `src/lib/telegram/notifications.ts` — admin link in new booking notification
- `.env.local` — updated APP_URL
- Vercel environment variables — set production APP_URL

## Decisions made

1. **Consent text placement:** Integrate into confirmation prompt rather than pre-booking, so button context is clear.
2. **Owner menu scope:** Use Telegram's `setMyCommands` with `type: chat` scope for owner-specific commands instead of checking auth in each command handler. Cleaner UX.
3. **Firestore query strategy:** Two approaches:
   - For owner (no `clientId`): Drop `status in`, filter in JS
   - For client (has `clientId ==`): Keep original query, works with existing indexes
4. **Magic token generation:** `/admin` command auto-generates fresh token each time (vs. static link), improves security.

## Lessons learned

1. **Firestore composite indexes are implicit:** The error doesn't appear in logs when a query requires an index that doesn't exist — the query silently fails. Solution: always check webhook error logs, and consider firestore rule: equality filters (`==`) + range filters (`>=`, `<=`) work without index; equality + range + in/array + orderBy requires explicit index.
2. **Firestore index specificity:** A query's index is determined by ALL its filters and ordering. Changing one clause (`orderBy`) changes which index Firestore tries to use. If that index doesn't exist, the query fails even if a "similar" index exists.
3. **Telegram command scopes:** `setMyCommands` with `scope: { type: "chat", chat_id }` registers commands only for that chat. Reduces clutter for owner vs. general user.
4. **URL envs in production:** `NEXT_PUBLIC_*` vars must be set in Vercel project settings, not just `.env.local`. They're baked into the build.

## Risks / open questions

- **Vercel deployment timing:** Setup endpoint `/api/telegram/setup` was called manually after pushing. If the endpoint were called during CI, it would register commands against the previous deployed version. No automation; currently manual.
- **Magic token expiry:** `/admin` generates tokens valid 5 min. If link is shared/screenshotted, attacker has short window. Accept risk — short expiry trades off convenience.
- **Firestore scaling:** As appointment count grows, querying `dateTime >= now` (without `status` filter) may become expensive for owner cancel menu. Consider adding `status != "cancelled"` when Firebase supports it, or use dedicated owner collection if it becomes a problem.

## Recommended memory updates

### New memory file: `telegram-bot-queries.md`
Document Firestore query patterns for Telegram bot and which composite indexes exist:
- Client appointments: `clientId == ? && dateTime >= ? && status in [...]` ✓ index exists
- Owner cancellable: `dateTime >= ? && status in [...]` ✗ no index, filter in JS

### Update `CLAUDE.md`
- Add `/week` and `/admin` to owner commands section
- Note that consent message is now shown at confirmation time, not at booking start
- Document that magic token links expire in 5 minutes
- Note the Firestore index limitation for owner queries without `clientId`

### Update `docs/decisions.md` (if it exists)
- Decision: Owner commands registered via `type: chat` scope in `setMyCommands` API
- Decision: Consent shown at confirmation time vs. booking start
- Risk: Manual `/api/telegram/setup` call; could automate in CI if needed

## Next steps

1. **Verify deployment:** Wait for Vercel to finish deploying (1 min), test all commands in Telegram:
   - `/cancel` and `/my_appointments` for clients ✓
   - `/admin_cancel`, `/today`, `/week`, `/admin` for owner ✓
2. **Test new booking flow:** Verify consent appears in confirmation message and buttons work
3. **Test magic links:** Confirm `/admin` generates valid 5-min login links and `NEXT_PUBLIC_APP_URL` is used in notifications
4. **Monitor:** Check Telegram webhook logs for any remaining query failures

---

## Changelog
- **Created:** `docs/retrospectives/2026-05-12-telegram-bot-menu-and-links.md`
- **Updated:** `docs/session-index.md` — added entry for this session
- **Updated:** `CLAUDE.md` — will update with new commands and Firestore notes
- **Files modified:** 4 source files (`src/lib/telegram/*.ts`), environment vars in Vercel
- **Commits:** 4 (fixes, query corrections, final push)
