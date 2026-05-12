import { adminDb } from "@/lib/firebase/admin";
import { Timestamp, FieldValue } from "firebase-admin/firestore";
import { sendMessage, sendDocument, answerCallbackQuery, buildInlineKeyboard, buildReplyKeyboard } from "./bot";
import { confirmationMessage, confirmedMessage, cancelledMessage, welcomeMessage, bookingStartMessage, askPhoneMessage, sharePhoneButton, selectDateMessage, selectTimeMessage, bookingConfirmedMessage, noSlotsMessage, confirmBookingPrompt } from "./messages";
import { confirmCalendarEvent, deleteCalendarEvent, createCalendarEvent } from "@/lib/calendar/google";
import { notifyOwnerOfCancellation, notifyOwnerOfConfirmation, notifyOwnerOfNewBooking } from "./notifications";
import { generateIcsFile, generateGoogleCalendarUrl } from "@/lib/calendar/client-links";
import { getAvailableSlots, getDaysWithAvailability, getNowLocalForSlots } from "@/lib/slots";
import { parse, format, startOfDay, endOfDay } from "date-fns";
import { parseInTimeZone, formatInTimeZone, startOfDayInTimeZone, endOfDayInTimeZone, nowInTimeZone } from "@/lib/date-utils";
import type { BusinessConfig, Appointment } from "@/types";

interface TelegramUpdate {
  message?: {
    chat: { id: number };
    from?: { id: number; first_name?: string; last_name?: string };
    text?: string;
    contact?: { phone_number: string };
  };
  callback_query?: {
    id: string;
    from: { id: number };
    message?: { chat: { id: number } };
    data?: string;
  };
}

async function getConfig(): Promise<BusinessConfig | null> {
  const snap = await adminDb.collection("businessConfig").doc("main").get();
  return snap.exists ? (snap.data() as BusinessConfig) : null;
}

async function getClientByChat(chatId: number) {
  const snap = await adminDb
    .collection("clients")
    .where("telegramChatId", "==", String(chatId))
    .limit(1)
    .get();
  return snap.empty ? null : { id: snap.docs[0].id, ...snap.docs[0].data() };
}

async function getAvailableDatesWithBookings(config: BusinessConfig): Promise<string[]> {
  const tz = config.timezone || "Europe/Kyiv";
  const todayStr = nowInTimeZone(tz).date;
  const now = new Date();
  const rangeEnd = new Date(now);
  rangeEnd.setDate(rangeEnd.getDate() + 15);

  const dayStartUtc = startOfDayInTimeZone(todayStr, tz);

  const snap = await adminDb
    .collection("appointments")
    .where("dateTime", ">=", dayStartUtc)
    .where("dateTime", "<=", rangeEnd)
    .get();

  const allAppointments = snap.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
    dateTime: doc.data().dateTime.toDate(),
  })) as Appointment[];

  return getDaysWithAvailability(now, 14, config, allAppointments);
}

export async function handleTelegramUpdate(update: TelegramUpdate) {
  if (update.callback_query) {
    await handleCallbackQuery(update.callback_query);
    return;
  }

  if (update.message) {
    await handleMessage(update.message);
  }
}

async function handleCallbackQuery(query: {
  id: string;
  from: { id: number };
  message?: { chat: { id: number } };
  data?: string;
}) {
  const chatId = query.message?.chat.id;
  if (!chatId || !query.data) return;

  await answerCallbackQuery(query.id);

  const [action, appointmentId] = query.data.split(":");
  const client = await getClientByChat(chatId);
  const lang = (client as { language?: string })?.language || "uk";

  if (action === "confirm" && appointmentId) {
    const doc = await adminDb.collection("appointments").doc(appointmentId).get();
    if (!doc.exists) return;

    const appointment = doc.data()!;
    await adminDb.collection("appointments").doc(appointmentId).update({
      status: "confirmed",
      updatedAt: Timestamp.now(),
    });

    if (appointment.googleCalendarEventId) {
      try { await confirmCalendarEvent(appointment.googleCalendarEventId); } catch {}
    }

    if (client) {
      await adminDb.collection("clients").doc((client as { id: string }).id).update({
        confirmedAppointments: FieldValue.increment(1),
        updatedAt: Timestamp.now(),
      });
    }

    const appUrlForClient = process.env.NEXT_PUBLIC_APP_URL || "";
    await sendMessage(chatId, confirmedMessage(lang), {
      replyMarkup: appUrlForClient ? buildInlineKeyboard([
        [{ text: lang === "uk" ? "🌐 На сайт" : "🌐 Visit website", url: appUrlForClient }],
      ]) : undefined,
    });
    await sendCalendarLinks(chatId, appointment, lang);
    await notifyOwnerOfConfirmation({
      clientName: appointment.clientName,
      dateTime: appointment.dateTime,
    });
  }

  if (action === "cancel" && appointmentId) {
    const doc = await adminDb.collection("appointments").doc(appointmentId).get();
    if (!doc.exists) return;

    const appointment = doc.data()!;
    await adminDb.collection("appointments").doc(appointmentId).update({
      status: "cancelled",
      updatedAt: Timestamp.now(),
    });

    if (appointment.googleCalendarEventId) {
      try { await deleteCalendarEvent(appointment.googleCalendarEventId); } catch {}
    }

    if (client) {
      await adminDb.collection("clients").doc((client as { id: string }).id).update({
        cancelledAppointments: FieldValue.increment(1),
        updatedAt: Timestamp.now(),
      });
    }

    await sendMessage(chatId, cancelledMessage(lang));
    await notifyOwnerOfCancellation({
      clientName: appointment.clientName,
      dateTime: appointment.dateTime,
    });
  }

  if (action === "cancel_apt") {
    const aptDoc = await adminDb.collection("appointments").doc(appointmentId).get();
    if (!aptDoc.exists) return;

    const apt = aptDoc.data()!;
    await adminDb.collection("appointments").doc(appointmentId).update({
      status: "cancelled",
      updatedAt: Timestamp.now(),
    });

    if (apt.googleCalendarEventId) {
      try { await deleteCalendarEvent(apt.googleCalendarEventId); } catch {}
    }

    if (client) {
      await adminDb.collection("clients").doc((client as { id: string }).id).update({
        cancelledAppointments: FieldValue.increment(1),
        updatedAt: Timestamp.now(),
      });
    }

    await sendMessage(chatId, cancelledMessage(lang));
    await notifyOwnerOfCancellation({
      clientName: apt.clientName,
      dateTime: apt.dateTime,
    });
  }

  if (action === "owner_cancel") {
    const aptDoc = await adminDb.collection("appointments").doc(appointmentId).get();
    if (!aptDoc.exists) return;

    const apt = aptDoc.data()!;
    await adminDb.collection("appointments").doc(appointmentId).update({
      status: "cancelled",
      updatedAt: Timestamp.now(),
    });

    if (apt.googleCalendarEventId) {
      try { await deleteCalendarEvent(apt.googleCalendarEventId); } catch {}
    }

    if (apt.clientId) {
      try {
        await adminDb.collection("clients").doc(apt.clientId).update({
          cancelledAppointments: FieldValue.increment(1),
          updatedAt: Timestamp.now(),
        });
      } catch {}
    }

    if (apt.clientId) {
      try {
        const { notifyClientOfCancellation } = await import("./notifications");
        await notifyClientOfCancellation({ clientId: apt.clientId, dateTime: apt.dateTime });
      } catch {}
    }

    await sendMessage(chatId, `✅ Запис скасовано: ${apt.clientName}`);
  }

  if (action === "book_confirm") {
    await handleBookingConfirm(chatId, lang);
    return;
  }

  if (action === "book_cancel") {
    await adminDb.collection("bookingSessions").doc(String(chatId)).delete();
    await sendMessage(chatId, lang === "uk" ? "❌ Бронювання скасовано." : "❌ Booking cancelled.");
    return;
  }

  if (action === "date") {
    await handleDateSelection(chatId, query.data.replace("date:", ""), lang);
  }

  if (action === "time") {
    const rest = query.data.slice("time:".length);
    const dateStr = rest.slice(0, 10);
    const timeStr = rest.slice(11);
    await handleTimeSelection(chatId, dateStr, timeStr, lang);
  }
}

async function handleMessage(message: {
  chat: { id: number };
  from?: { id: number; first_name?: string; last_name?: string };
  text?: string;
  contact?: { phone_number: string };
}) {
  const chatId = message.chat.id;
  const text = message.text?.trim() || "";
  const client = await getClientByChat(chatId);
  const lang = (client as { language?: string })?.language || "uk";

  if (text.startsWith("/start")) {
    const payload = text.replace("/start", "").trim();

    if (payload && !client) {
      const clientQuery = await adminDb
        .collection("clients")
        .where("phone", "==", payload)
        .limit(1)
        .get();

      if (!clientQuery.empty) {
        await adminDb.collection("clients").doc(clientQuery.docs[0].id).update({
          telegramChatId: String(chatId),
          updatedAt: Timestamp.now(),
        });
      }
    }

    if (payload) {
      const appointmentDoc = await adminDb.collection("appointments").doc(payload).get();
      if (appointmentDoc.exists) {
        const apt = appointmentDoc.data()!;
        if (!client) {
          await adminDb.collection("clients").doc(apt.clientId).update({
            telegramChatId: String(chatId),
            updatedAt: Timestamp.now(),
          });
        }

        const config = await getConfig();
        const serviceName = config?.serviceName || "Appointment";

        await sendMessage(chatId, confirmationMessage(lang, {
          date: apt.dateTime.toDate(),
          serviceName,
          timezone: config?.timezone,
        }), {
          replyMarkup: buildInlineKeyboard([
            [
              { text: "✅ " + (lang === "uk" ? "Підтвердити" : "Confirm"), callbackData: `confirm:${payload}` },
              { text: "❌ " + (lang === "uk" ? "Скасувати" : "Cancel"), callbackData: `cancel:${payload}` },
            ],
          ]),
        });
        return;
      }
    }

    const config = await getConfig();
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "";
    const isOwner = config?.ownerTelegramChatId === String(chatId);

    if (isOwner) {
      let adminUrl = `${appUrl}/admin`;
      try {
        const tokenRes = await fetch(`${appUrl}/api/auth/magic-token`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chatId: String(chatId) }),
        });
        const tokenData = await tokenRes.json();
        if (tokenData.token) {
          adminUrl = `${appUrl}/admin/login?token=${tokenData.token}`;
        }
      } catch {}

      await sendMessage(chatId, "👋 Вітаємо! Ви увійшли як власник.\n\n/today — записи на сьогодні\n/admin_cancel — скасувати запис клієнта", {
        replyMarkup: buildInlineKeyboard([
          [{ text: "📋 Адмін-панель", url: adminUrl }],
          [{ text: "🌐 Веб-сайт", url: appUrl }],
        ]),
      });
    } else {
      await sendMessage(chatId, welcomeMessage(lang), {
        replyMarkup: appUrl ? buildInlineKeyboard([
          [{ text: lang === "uk" ? "🌐 Записатися на сайті" : "🌐 Book on website", url: `${appUrl}/book` }],
        ]) : undefined,
      });
    }
    return;
  }

  if (text === "/book") {
    await startBookingFlow(chatId, message.from, lang);
    return;
  }

  if (text === "/my_appointments") {
    await showMyAppointments(chatId, lang);
    return;
  }

  if (text === "/cancel") {
    await showCancelMenu(chatId, lang);
    return;
  }

  if (text === "/today") {
    const config = await getConfig();
    if (config?.ownerTelegramChatId === String(chatId)) {
      await showOwnerDayOverview(chatId);
      return;
    }
  }

  if (text === "/week") {
    const config = await getConfig();
    if (config?.ownerTelegramChatId === String(chatId)) {
      await showOwnerWeekOverview(chatId);
      return;
    }
  }

  if (text === "/admin_cancel") {
    const config = await getConfig();
    if (config?.ownerTelegramChatId === String(chatId)) {
      await showOwnerCancelMenu(chatId);
      return;
    }
  }

  if (text === "/admin") {
    const config = await getConfig();
    if (config?.ownerTelegramChatId === String(chatId)) {
      await sendOwnerAdminLink(chatId);
      return;
    }
  }

  // Handle booking flow state (phone via contact sharing)
  if (message.contact) {
    await handlePhoneShared(chatId, message.contact.phone_number, lang);
    return;
  }

  // Handle booking flow state
  const sessionSnap = await adminDb.collection("bookingSessions").doc(String(chatId)).get();
  if (sessionSnap.exists) {
    if (text.startsWith("/")) {
      await adminDb.collection("bookingSessions").doc(String(chatId)).delete();
      await sendMessage(chatId, lang === "uk" ? "Бронювання скасовано." : "Booking cancelled.");
      return;
    }

    const session = sessionSnap.data()!;
    if (session.step === "awaiting_name") {
      await adminDb.collection("bookingSessions").doc(String(chatId)).update({
        name: text,
        step: "awaiting_phone",
      });
      await sendMessage(chatId, askPhoneMessage(lang), {
        replyMarkup: buildReplyKeyboard([
          [{ text: sharePhoneButton(lang), requestContact: true }],
        ]),
      });
      return;
    }

    if (session.step === "awaiting_confirmation" && text) {
      await adminDb.collection("bookingSessions").doc(String(chatId)).update({
        notes: text,
      });
      await sendMessage(
        chatId,
        lang === "uk"
          ? `💬 Коментар збережено: "${text}"\n\nНатисніть ✅ Підтвердити для завершення.`
          : `💬 Comment saved: "${text}"\n\nPress ✅ Confirm to finish.`
      );
      return;
    }
  }
}

async function startBookingFlow(
  chatId: number,
  from?: { id: number; first_name?: string; last_name?: string },
  lang = "uk"
) {
  const existingClient = await getClientByChat(chatId);

  if (existingClient) {
    const clientData = existingClient as { id: string; firstName?: string; phone?: string };
    await adminDb.collection("bookingSessions").doc(String(chatId)).set({
      step: "awaiting_date",
      name: clientData.firstName || from?.first_name || "",
      phone: clientData.phone || "",
      chatId,
      lang,
      createdAt: Timestamp.now(),
    });

    const config = await getConfig();
    if (!config) return;

    const availableDates = await getAvailableDatesWithBookings(config);
    const buttons = availableDates.slice(0, 7).map((d) => [
      { text: d, callbackData: `date:${d}` },
    ]);

    await sendMessage(chatId, selectDateMessage(lang), {
      replyMarkup: buildInlineKeyboard(buttons),
    });
    return;
  }

  await adminDb.collection("bookingSessions").doc(String(chatId)).set({
    step: "awaiting_name",
    name: from?.first_name || "",
    phone: "",
    chatId,
    lang,
    isNewClient: true,
    createdAt: Timestamp.now(),
  });

  await sendMessage(chatId, bookingStartMessage(lang));
}

async function handlePhoneShared(chatId: number, phone: string, lang: string) {
  const sessionSnap = await adminDb.collection("bookingSessions").doc(String(chatId)).get();
  if (!sessionSnap.exists) return;

  await adminDb.collection("bookingSessions").doc(String(chatId)).update({
    phone,
    step: "awaiting_date",
  });

  const config = await getConfig();
  if (!config) return;

  const availableDates = await getAvailableDatesWithBookings(config);
  const buttons = availableDates.slice(0, 7).map((d) => [
    { text: d, callbackData: `date:${d}` },
  ]);

  await sendMessage(chatId, selectDateMessage(lang), {
    replyMarkup: buildInlineKeyboard(buttons),
  });
}

async function handleDateSelection(chatId: number, dateStr: string, lang: string) {
  const config = await getConfig();
  if (!config) return;

  const tz = config.timezone || "Europe/Kyiv";
  const date = parse(dateStr, "yyyy-MM-dd", new Date());

  const dayStart = startOfDayInTimeZone(dateStr, tz);
  const dayEnd = endOfDayInTimeZone(dateStr, tz);

  const appointmentsSnap = await adminDb
    .collection("appointments")
    .where("dateTime", ">=", dayStart)
    .where("dateTime", "<=", dayEnd)
    .get();

  const appointments = appointmentsSnap.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
    dateTime: doc.data().dateTime.toDate(),
  })) as Appointment[];

  const nowLocal = getNowLocalForSlots(date, tz);
  const slots = getAvailableSlots(date, config, appointments, nowLocal);

  if (slots.length === 0) {
    const availableDates = await getAvailableDatesWithBookings(config);
    const buttons = availableDates.slice(0, 7).map((d) => [
      { text: d, callbackData: `date:${d}` },
    ]);
    await sendMessage(chatId, noSlotsMessage(lang), {
      replyMarkup: buildInlineKeyboard(buttons),
    });
    return;
  }

  await adminDb.collection("bookingSessions").doc(String(chatId)).update({
    selectedDate: dateStr,
    step: "awaiting_time",
  });

  const buttons = slots.map((slot) => [
    { text: slot, callbackData: `time:${dateStr}:${slot}` },
  ]);

  await sendMessage(chatId, selectTimeMessage(lang), {
    replyMarkup: buildInlineKeyboard(buttons),
  });
}

async function handleTimeSelection(chatId: number, dateStr: string, timeStr: string, lang: string) {
  const sessionSnap = await adminDb.collection("bookingSessions").doc(String(chatId)).get();
  if (!sessionSnap.exists) return;

  const config = await getConfig();
  if (!config) return;

  const dateTime = parseInTimeZone(`${dateStr} ${timeStr}`, config.timezone || "Europe/Kyiv");
  const serviceName = config.serviceName || "Appointment";

  await adminDb.collection("bookingSessions").doc(String(chatId)).update({
    selectedDate: dateStr,
    selectedTime: timeStr,
    step: "awaiting_confirmation",
    notes: "",
  });

  const sessionData = sessionSnap.data()!;
  const isNewClient = !!sessionData.isNewClient;

  await sendMessage(chatId, confirmBookingPrompt(lang, { date: dateTime, serviceName, timezone: config.timezone, isNewClient }), {
    replyMarkup: buildInlineKeyboard([
      [
        { text: lang === "uk" ? "✅ Підтвердити" : "✅ Confirm", callbackData: "book_confirm" },
        { text: lang === "uk" ? "❌ Скасувати" : "❌ Cancel", callbackData: "book_cancel" },
      ],
    ]),
  });
}

async function handleBookingConfirm(chatId: number, lang: string) {
  const sessionSnap = await adminDb.collection("bookingSessions").doc(String(chatId)).get();
  if (!sessionSnap.exists) return;

  const session = sessionSnap.data()!;
  const config = await getConfig();
  if (!config) return;

  const dateTime = parseInTimeZone(`${session.selectedDate} ${session.selectedTime}`, config.timezone || "Europe/Kyiv");
  const durationMinutes = config.defaultDurationMinutes || 30;
  const serviceName = config.serviceName || "Appointment";
  const notes = session.notes?.trim() || null;

  let clientId: string;
  const clientQuery = await adminDb
    .collection("clients")
    .where("phone", "==", session.phone)
    .limit(1)
    .get();

  if (clientQuery.empty) {
    const ref = await adminDb.collection("clients").add({
      firstName: session.name,
      phone: session.phone,
      telegramChatId: String(chatId),
      language: lang,
      consentGiven: true,
      consentTimestamp: Timestamp.now(),
      consentLanguage: lang,
      consentJurisdiction: config.jurisdiction || "UA",
      totalAppointments: 0,
      confirmedAppointments: 0,
      cancelledAppointments: 0,
      noShowAppointments: 0,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });
    clientId = ref.id;
  } else {
    clientId = clientQuery.docs[0].id;
    await adminDb.collection("clients").doc(clientId).update({
      telegramChatId: String(chatId),
      updatedAt: Timestamp.now(),
    });
  }

  let googleCalendarEventId: string | undefined;
  const calendarDescription = `Phone: ${session.phone}\nSource: Telegram` + (notes ? `\nComment: ${notes}` : "");
  try {
    googleCalendarEventId = await createCalendarEvent({
      summary: `${serviceName} — ${session.name}`,
      startTime: dateTime,
      durationMinutes,
      description: calendarDescription,
    });
    if (googleCalendarEventId) {
      await confirmCalendarEvent(googleCalendarEventId);
    }
  } catch {}

  const tz = config.timezone || "Europe/Kyiv";
  const bookingDate = parse(session.selectedDate, "yyyy-MM-dd", new Date());
  const dayStart = startOfDayInTimeZone(session.selectedDate, tz);
  const dayEnd = endOfDayInTimeZone(session.selectedDate, tz);
  const appointmentRef = adminDb.collection("appointments").doc();

  const slotTaken = await adminDb.runTransaction(async (tx) => {
    const existingSnap = await tx.get(
      adminDb
        .collection("appointments")
        .where("dateTime", ">=", dayStart)
        .where("dateTime", "<=", dayEnd)
    );

    const existingAppointments = existingSnap.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
      dateTime: doc.data().dateTime.toDate(),
    })) as Appointment[];

    const nowLocal = getNowLocalForSlots(bookingDate, tz);
    const availableSlots = getAvailableSlots(bookingDate, config as BusinessConfig, existingAppointments, nowLocal);

    if (!availableSlots.includes(session.selectedTime)) {
      return true;
    }

    tx.set(appointmentRef, {
      clientId,
      clientName: session.name,
      clientPhone: session.phone,
      dateTime: Timestamp.fromDate(dateTime),
      durationMinutes,
      status: "confirmed",
      source: "telegram",
      googleCalendarEventId: googleCalendarEventId || null,
      reminder24hSent: false,
      reminder2hSent: false,
      notes,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });

    tx.update(adminDb.collection("clients").doc(clientId), {
      totalAppointments: FieldValue.increment(1),
      confirmedAppointments: FieldValue.increment(1),
      updatedAt: Timestamp.now(),
    });

    return false;
  });

  await adminDb.collection("bookingSessions").doc(String(chatId)).delete();

  if (slotTaken) {
    await sendMessage(
      chatId,
      lang === "uk"
        ? "😔 На жаль, цей час вже зайнятий. Спробуйте /book знову."
        : "😔 Sorry, this time slot is no longer available. Try /book again."
    );
    return;
  }

  await sendMessage(chatId, bookingConfirmedMessage(lang, { date: dateTime, serviceName, timezone: config.timezone }));
  await sendCalendarLinks(chatId, { dateTime: { toDate: () => dateTime }, durationMinutes }, lang);

  await notifyOwnerOfNewBooking({
    clientName: session.name,
    dateTime: { toDate: () => dateTime },
    phone: session.phone,
    notes,
  });
}

async function sendCalendarLinks(chatId: number, appointment: Record<string, unknown>, lang: string) {
  const config = await getConfig();
  const serviceName = config?.serviceName || "Appointment";
  const dateTime = typeof (appointment.dateTime as { toDate?: () => Date }).toDate === "function"
    ? (appointment.dateTime as { toDate: () => Date }).toDate()
    : appointment.dateTime as Date;
  const durationMinutes = appointment.durationMinutes as number;

  const googleUrl = generateGoogleCalendarUrl({
    title: serviceName,
    startTime: dateTime,
    durationMinutes,
  });

  const icsContent = generateIcsFile({
    title: serviceName,
    startTime: dateTime,
    durationMinutes,
  });

  await sendMessage(chatId, lang === "uk" ? "📅 Додати в календар:" : "📅 Add to calendar:", {
    replyMarkup: buildInlineKeyboard([
      [{ text: "Google Calendar", url: googleUrl }],
    ]),
  });

  await sendDocument(
    chatId,
    Buffer.from(icsContent, "utf-8"),
    "appointment.ics",
    { caption: lang === "uk" ? "Файл для Apple/Outlook календаря" : "File for Apple/Outlook calendar" }
  );
}

async function showCancelMenu(chatId: number, lang: string) {
  const client = await getClientByChat(chatId);
  if (!client) {
    await sendMessage(chatId, lang === "uk" ? "У вас немає записів для скасування." : "You have no appointments to cancel.");
    return;
  }

  const now = new Date();
  const snap = await adminDb
    .collection("appointments")
    .where("clientId", "==", (client as { id: string }).id)
    .where("dateTime", ">=", now)
    .limit(10)
    .get();

  const cancelable = snap.docs
    .filter((d) => ["booked", "confirmed"].includes(d.data().status))
    .sort((a, b) => a.data().dateTime.toDate().getTime() - b.data().dateTime.toDate().getTime())
    .slice(0, 5);

  if (cancelable.length === 0) {
    await sendMessage(chatId, lang === "uk" ? "У вас немає майбутніх записів для скасування." : "You have no upcoming appointments to cancel.");
    return;
  }

  const config = await getConfig();
  const tz = config?.timezone || "Europe/Kyiv";

  const buttons = cancelable.map((doc) => {
    const d = doc.data();
    const dateStr = formatInTimeZone(d.dateTime.toDate(), tz, "dd.MM.yyyy HH:mm");
    return [{ text: `❌ ${dateStr}`, callbackData: `cancel_apt:${doc.id}` }];
  });

  await sendMessage(
    chatId,
    lang === "uk" ? "Оберіть запис для скасування:" : "Select appointment to cancel:",
    { replyMarkup: buildInlineKeyboard(buttons) }
  );
}

async function showMyAppointments(chatId: number, lang: string) {
  const client = await getClientByChat(chatId);
  if (!client) {
    await sendMessage(chatId, lang === "uk" ? "У вас поки немає записів." : "You don't have any appointments yet.");
    return;
  }

  const config = await getConfig();
  const tz = config?.timezone || "Europe/Kyiv";

  const now = new Date();
  const snap = await adminDb
    .collection("appointments")
    .where("clientId", "==", (client as { id: string }).id)
    .where("dateTime", ">=", now)
    .limit(10)
    .get();

  const upcoming = snap.docs
    .filter((d) => ["booked", "confirmed"].includes(d.data().status))
    .sort((a, b) => a.data().dateTime.toDate().getTime() - b.data().dateTime.toDate().getTime())
    .slice(0, 5);

  if (upcoming.length === 0) {
    await sendMessage(chatId, lang === "uk" ? "У вас немає майбутніх записів." : "You have no upcoming appointments.");
    return;
  }

  const lines = upcoming.map((doc) => {
    const d = doc.data();
    const dateStr = formatInTimeZone(d.dateTime.toDate(), tz, "dd.MM.yyyy HH:mm");
    const status = d.status === "confirmed" ? "✅" : "⏳";
    return `${status} ${dateStr}`;
  });

  await sendMessage(chatId, (lang === "uk" ? "📋 Ваші записи:\n\n" : "📋 Your appointments:\n\n") + lines.join("\n"));
}

async function showOwnerDayOverview(chatId: number) {
  const config = await getConfig();
  const tz = config?.timezone || "Europe/Kyiv";
  const todayStr = nowInTimeZone(tz).date;

  const dayStartUtc = startOfDayInTimeZone(todayStr, tz);
  const dayEndUtc = endOfDayInTimeZone(todayStr, tz);

  const snap = await adminDb
    .collection("appointments")
    .where("dateTime", ">=", dayStartUtc)
    .where("dateTime", "<=", dayEndUtc)
    .orderBy("dateTime", "asc")
    .get();

  const active = snap.docs.filter((d) => d.data().status !== "cancelled");

  if (active.length === 0) {
    await sendMessage(chatId, "📋 Сьогодні немає записів.");
    return;
  }

  const lines = active.map((doc) => {
    const d = doc.data();
    const time = formatInTimeZone(d.dateTime.toDate(), tz, "HH:mm");
    const status = d.status === "confirmed" ? "✅" : "⏳";
    const phone = d.clientPhone ? ` | ${d.clientPhone}` : "";
    const notes = d.notes ? `\n   💬 ${d.notes}` : "";
    return `${status} <b>${time}</b> — ${d.clientName}${phone}${notes}`;
  });

  await sendMessage(
    chatId,
    `📋 <b>Записи на сьогодні (${todayStr.split("-").reverse().join(".")}):</b>\n\n${lines.join("\n\n")}`
  );
}

async function showOwnerCancelMenu(chatId: number) {
  const now = new Date();
  const snap = await adminDb
    .collection("appointments")
    .where("dateTime", ">=", now)
    .limit(20)
    .get();

  const active = snap.docs
    .filter((d) => ["booked", "confirmed"].includes(d.data().status))
    .sort((a, b) => a.data().dateTime.toDate().getTime() - b.data().dateTime.toDate().getTime())
    .slice(0, 10);

  if (active.length === 0) {
    await sendMessage(chatId, "Немає майбутніх записів для скасування.");
    return;
  }

  const config = await getConfig();
  const tz = config?.timezone || "Europe/Kyiv";

  const sorted = active;

  const buttons = sorted.map((doc) => {
    const d = doc.data();
    const dateStr = formatInTimeZone(d.dateTime.toDate(), tz, "dd.MM HH:mm");
    return [{ text: `❌ ${dateStr} — ${d.clientName}`, callbackData: `owner_cancel:${doc.id}` }];
  });

  await sendMessage(chatId, "Оберіть запис для скасування (клієнт буде повідомлений):", {
    replyMarkup: buildInlineKeyboard(buttons),
  });
}

async function showOwnerWeekOverview(chatId: number) {
  const config = await getConfig();
  const tz = config?.timezone || "Europe/Kyiv";
  const todayStr = nowInTimeZone(tz).date;

  const weekStart = startOfDayInTimeZone(todayStr, tz);
  const weekEndDate = new Date(weekStart);
  weekEndDate.setDate(weekEndDate.getDate() + 7);

  const snap = await adminDb
    .collection("appointments")
    .where("dateTime", ">=", weekStart)
    .where("dateTime", "<", weekEndDate)
    .orderBy("dateTime", "asc")
    .get();

  const active = snap.docs.filter((d) => d.data().status !== "cancelled");

  if (active.length === 0) {
    await sendMessage(chatId, "📋 Немає записів на найближчі 7 днів.");
    return;
  }

  const byDay = new Map<string, string[]>();
  for (const doc of active) {
    const d = doc.data();
    const dateObj = d.dateTime.toDate();
    const dayDate = formatInTimeZone(dateObj, tz, "dd.MM.yyyy");
    const dayName = new Intl.DateTimeFormat("uk-UA", { timeZone: tz, weekday: "long" }).format(dateObj);
    const dayKey = `${dayDate} (${dayName})`;
    const time = formatInTimeZone(dateObj, tz, "HH:mm");
    const status = d.status === "confirmed" ? "✅" : "⏳";
    const phone = d.clientPhone ? ` | ${d.clientPhone}` : "";
    const notes = d.notes ? ` 💬${d.notes}` : "";
    const line = `  ${status} <b>${time}</b> — ${d.clientName}${phone}${notes}`;
    if (!byDay.has(dayKey)) byDay.set(dayKey, []);
    byDay.get(dayKey)!.push(line);
  }

  const sections: string[] = [];
  for (const [day, lines] of byDay) {
    sections.push(`📅 <b>${day}</b>\n${lines.join("\n")}`);
  }

  await sendMessage(chatId, `📋 <b>Записи на 7 днів:</b>\n\n${sections.join("\n\n")}`);
}

async function sendOwnerAdminLink(chatId: number) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "";
  if (!appUrl) {
    await sendMessage(chatId, "⚠️ APP_URL не налаштований.");
    return;
  }

  let adminUrl = `${appUrl}/admin`;
  try {
    const tokenRes = await fetch(`${appUrl}/api/auth/magic-token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chatId: String(chatId) }),
    });
    const tokenData = await tokenRes.json();
    if (tokenData.token) {
      adminUrl = `${appUrl}/admin/login?token=${tokenData.token}`;
    }
  } catch {}

  await sendMessage(chatId, "🔗 Посилання дійсне 5 хвилин:", {
    replyMarkup: buildInlineKeyboard([
      [{ text: "📋 Адмін-панель", url: adminUrl }],
    ]),
  });
}
