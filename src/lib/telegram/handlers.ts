import { adminDb } from "@/lib/firebase/admin";
import { Timestamp } from "firebase-admin/firestore";
import { sendMessage, sendDocument, answerCallbackQuery, buildInlineKeyboard, buildReplyKeyboard } from "./bot";
import { confirmationMessage, confirmedMessage, cancelledMessage, welcomeMessage, bookingStartMessage, askPhoneMessage, sharePhoneButton, selectDateMessage, selectTimeMessage, bookingConfirmedMessage, noSlotsMessage, consentMessage } from "./messages";
import { confirmCalendarEvent, deleteCalendarEvent, createCalendarEvent } from "@/lib/calendar/google";
import { notifyOwnerOfCancellation } from "./notifications";
import { generateIcsFile, generateGoogleCalendarUrl } from "@/lib/calendar/client-links";
import { getAvailableSlots, getDaysWithAvailability } from "@/lib/slots";
import { parse, format } from "date-fns";
import { parseInTimeZone } from "@/lib/date-utils";
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
        confirmedAppointments: (((client as Record<string, unknown>).confirmedAppointments as number) || 0) + 1,
        updatedAt: Timestamp.now(),
      });
    }

    await sendMessage(chatId, confirmedMessage(lang));
    await sendCalendarLinks(chatId, appointment, lang);
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
        cancelledAppointments: (((client as Record<string, unknown>).cancelledAppointments as number) || 0) + 1,
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
        cancelledAppointments: (((client as Record<string, unknown>).cancelledAppointments as number) || 0) + 1,
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
        const { notifyClientOfCancellation } = await import("./notifications");
        await notifyClientOfCancellation({ clientId: apt.clientId, dateTime: apt.dateTime });
      } catch {}
    }

    await sendMessage(chatId, `✅ Запис скасовано: ${apt.clientName}`);
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

    await sendMessage(chatId, welcomeMessage(lang));
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

  if (text === "/admin_cancel") {
    const config = await getConfig();
    if (config?.ownerTelegramChatId === String(chatId)) {
      await showOwnerCancelMenu(chatId);
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

    const availableDates = getDaysWithAvailability(new Date(), 14, config);
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
    createdAt: Timestamp.now(),
  });

  await sendMessage(chatId, consentMessage(lang));
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

  const availableDates = getDaysWithAvailability(new Date(), 14, config);
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

  const date = parse(dateStr, "yyyy-MM-dd", new Date());

  const dayStart = new Date(date);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(date);
  dayEnd.setHours(23, 59, 59, 999);

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

  const slots = getAvailableSlots(date, config, appointments);

  if (slots.length === 0) {
    const availableDates = getDaysWithAvailability(new Date(), 14, config);
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

  const session = sessionSnap.data()!;
  const config = await getConfig();
  if (!config) return;

  const dateTime = parseInTimeZone(`${dateStr} ${timeStr}`, config.timezone || "Europe/Kyiv");
  const durationMinutes = config.defaultDurationMinutes || 30;
  const serviceName = config.serviceName || "Appointment";

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
      totalAppointments: 1,
      confirmedAppointments: 1,
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
      totalAppointments: (clientQuery.docs[0].data().totalAppointments || 0) + 1,
      confirmedAppointments: (clientQuery.docs[0].data().confirmedAppointments || 0) + 1,
      updatedAt: Timestamp.now(),
    });
  }

  let googleCalendarEventId: string | undefined;
  try {
    googleCalendarEventId = await createCalendarEvent({
      summary: `${serviceName} — ${session.name}`,
      startTime: dateTime,
      durationMinutes,
      description: `Phone: ${session.phone}\nSource: Telegram`,
    });
    if (googleCalendarEventId) {
      await confirmCalendarEvent(googleCalendarEventId);
    }
  } catch {}

  await adminDb.collection("appointments").add({
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
    notes: null,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  });

  await adminDb.collection("bookingSessions").doc(String(chatId)).delete();

  await sendMessage(chatId, bookingConfirmedMessage(lang, { date: dateTime, serviceName }));
  await sendCalendarLinks(chatId, { dateTime: { toDate: () => dateTime }, durationMinutes }, lang);
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
    .where("status", "in", ["booked", "confirmed"])
    .orderBy("dateTime", "asc")
    .limit(5)
    .get();

  if (snap.empty) {
    await sendMessage(chatId, lang === "uk" ? "У вас немає майбутніх записів для скасування." : "You have no upcoming appointments to cancel.");
    return;
  }

  const buttons = snap.docs.map((doc) => {
    const d = doc.data();
    const dateStr = format(d.dateTime.toDate(), "dd.MM.yyyy HH:mm");
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

  const now = new Date();
  const snap = await adminDb
    .collection("appointments")
    .where("clientId", "==", (client as { id: string }).id)
    .where("dateTime", ">=", now)
    .where("status", "in", ["booked", "confirmed"])
    .orderBy("dateTime", "asc")
    .limit(5)
    .get();

  if (snap.empty) {
    await sendMessage(chatId, lang === "uk" ? "У вас немає майбутніх записів." : "You have no upcoming appointments.");
    return;
  }

  const lines = snap.docs.map((doc) => {
    const d = doc.data();
    const dateStr = format(d.dateTime.toDate(), "dd.MM.yyyy HH:mm");
    const status = d.status === "confirmed" ? "✅" : "⏳";
    return `${status} ${dateStr}`;
  });

  await sendMessage(chatId, (lang === "uk" ? "📋 Ваші записи:\n\n" : "📋 Your appointments:\n\n") + lines.join("\n"));
}

async function showOwnerDayOverview(chatId: number) {
  const now = new Date();
  const dayStart = new Date(now);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(now);
  dayEnd.setHours(23, 59, 59, 999);

  const snap = await adminDb
    .collection("appointments")
    .where("dateTime", ">=", dayStart)
    .where("dateTime", "<=", dayEnd)
    .orderBy("dateTime", "asc")
    .get();

  const active = snap.docs.filter((d) => d.data().status !== "cancelled");

  if (active.length === 0) {
    await sendMessage(chatId, "📋 Сьогодні немає записів.");
    return;
  }

  const lines = active.map((doc) => {
    const d = doc.data();
    const time = format(d.dateTime.toDate(), "HH:mm");
    const status = d.status === "confirmed" ? "✅" : "⏳";
    const phone = d.clientPhone ? ` | ${d.clientPhone}` : "";
    const notes = d.notes ? `\n   💬 ${d.notes}` : "";
    return `${status} <b>${time}</b> — ${d.clientName}${phone}${notes}`;
  });

  await sendMessage(
    chatId,
    `📋 <b>Записи на сьогодні (${format(now, "dd.MM.yyyy")}):</b>\n\n${lines.join("\n\n")}`
  );
}

async function showOwnerCancelMenu(chatId: number) {
  const now = new Date();
  const snap = await adminDb
    .collection("appointments")
    .where("dateTime", ">=", now)
    .where("status", "in", ["booked", "confirmed"])
    .orderBy("dateTime", "asc")
    .limit(10)
    .get();

  if (snap.empty) {
    await sendMessage(chatId, "Немає майбутніх записів для скасування.");
    return;
  }

  const buttons = snap.docs.map((doc) => {
    const d = doc.data();
    const dateStr = format(d.dateTime.toDate(), "dd.MM HH:mm");
    return [{ text: `❌ ${dateStr} — ${d.clientName}`, callbackData: `owner_cancel:${doc.id}` }];
  });

  await sendMessage(chatId, "Оберіть запис для скасування (клієнт буде повідомлений):", {
    replyMarkup: buildInlineKeyboard(buttons),
  });
}
