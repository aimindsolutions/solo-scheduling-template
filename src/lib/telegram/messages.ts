import { uk, enUS } from "date-fns/locale";
import { formatInTimeZone } from "@/lib/date-utils";

const localeMap = { uk, en: enUS } as const;

function getLocale(lang: string) {
  return localeMap[lang as keyof typeof localeMap] || uk;
}

function fmtDate(date: Date, tz: string, lang: string): string {
  const dateStr = formatInTimeZone(date, tz, "dd.MM.yyyy HH:mm");
  const locale = getLocale(lang);
  const monthDay = new Intl.DateTimeFormat(locale.code || "uk", {
    timeZone: tz,
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
  return monthDay;
}

export function confirmationMessage(
  lang: string,
  data: { date: Date; serviceName: string; timezone?: string }
) {
  const tz = data.timezone || "Europe/Kyiv";
  const dateStr = fmtDate(data.date, tz, lang);

  if (lang === "uk") {
    return `📅 Ви записалися на <b>${data.serviceName}</b>\n📆 ${dateStr}\n\nПідтвердіть або скасуйте запис:`;
  }
  return `📅 You booked <b>${data.serviceName}</b>\n📆 ${dateStr}\n\nPlease confirm or cancel:`;
}

export function confirmedMessage(lang: string) {
  if (lang === "uk") return "✅ Запис підтверджено! Чекаємо на вас.";
  return "✅ Appointment confirmed! See you there.";
}

export function cancelledMessage(lang: string) {
  if (lang === "uk") return "❌ Запис скасовано.";
  return "❌ Appointment cancelled.";
}

export function reminderMessage(
  lang: string,
  data: { date: Date; serviceName: string; hoursLeft: number; timezone?: string }
) {
  const tz = data.timezone || "Europe/Kyiv";
  const dateStr = fmtDate(data.date, tz, lang);

  if (lang === "uk") {
    const timeLabel = data.hoursLeft === 24 ? "завтра" : "через 2 години";
    return `🔔 Нагадування: ${data.serviceName} ${timeLabel}\n📆 ${dateStr}`;
  }
  const timeLabel = data.hoursLeft === 24 ? "tomorrow" : "in 2 hours";
  return `🔔 Reminder: ${data.serviceName} ${timeLabel}\n📆 ${dateStr}`;
}

export function welcomeMessage(lang: string) {
  if (lang === "uk") {
    return "👋 Вітаємо! Я бот для управління записами.\n\nНатисніть /book щоб записатися на прийом\nНатисніть /my_appointments щоб переглянути ваші записи";
  }
  return "👋 Welcome! I'm a booking assistant bot.\n\nPress /book to book an appointment\nPress /my_appointments to view your bookings";
}

export function bookingStartMessage(lang: string) {
  if (lang === "uk") return "Введіть ваше ім'я або надішліть /cancel щоб скасувати:";
  return "Enter your name or send /cancel to abort:";
}

export function askPhoneMessage(lang: string) {
  if (lang === "uk")
    return "Поділіться вашим номером телефону (натисніть кнопку нижче):";
  return "Share your phone number (tap the button below):";
}

export function sharePhoneButton(lang: string) {
  if (lang === "uk") return "📱 Поділитися номером";
  return "📱 Share Phone Number";
}

export function selectDateMessage(lang: string) {
  if (lang === "uk") return "Оберіть дату:";
  return "Select a date:";
}

export function selectTimeMessage(lang: string) {
  if (lang === "uk") return "Оберіть час:";
  return "Select a time:";
}

export function bookingConfirmedMessage(
  lang: string,
  data: { date: Date; serviceName: string; timezone?: string }
) {
  const tz = data.timezone || "Europe/Kyiv";
  const dateStr = fmtDate(data.date, tz, lang);

  if (lang === "uk") {
    return `✅ Запис створено!\n\n📅 ${data.serviceName}\n📆 ${dateStr}\n\nДодайте запис у свій календар:`;
  }
  return `✅ Appointment booked!\n\n📅 ${data.serviceName}\n📆 ${dateStr}\n\nAdd to your calendar:`;
}

export function confirmBookingPrompt(
  lang: string,
  data: { date: Date; serviceName: string; timezone?: string; isNewClient?: boolean }
) {
  const tz = data.timezone || "Europe/Kyiv";
  const dateStr = fmtDate(data.date, tz, lang);

  if (lang === "uk") {
    const consent = data.isNewClient
      ? "\n\n📋 Натискаючи «Підтвердити», ви погоджуєтесь, що ваше ім'я, телефон та дані запису будуть збережені для управління візитами та нагадувань."
      : "";
    return `📋 <b>Підтвердження запису:</b>\n\n📅 ${data.serviceName}\n📆 ${dateStr}\n\n💬 Можете додати коментар (просто напишіть текст) або натисніть кнопку для підтвердження:${consent}`;
  }
  const consent = data.isNewClient
    ? "\n\n📋 By pressing 'Confirm', you agree that your name, phone, and appointment data will be stored for managing visits and reminders."
    : "";
  return `📋 <b>Booking confirmation:</b>\n\n📅 ${data.serviceName}\n📆 ${dateStr}\n\n💬 You can add a comment (just type it) or press the button to confirm:${consent}`;
}

export function cancelConfirmPrompt(lang: string, dateStr: string) {
  if (lang === "uk") {
    return `❓ Скасувати запис на <b>${dateStr}</b>?\n\nМожете додати причину або підтвердити без неї.`;
  }
  return `❓ Cancel appointment on <b>${dateStr}</b>?\n\nYou can add a reason or confirm without one.`;
}

export function cancelReasonPrompt(lang: string) {
  if (lang === "uk") return "✏️ Введіть причину скасування:";
  return "✏️ Enter the reason for cancellation:";
}

export function noSlotsMessage(lang: string) {
  if (lang === "uk") return "На жаль, немає вільних слотів на цю дату. Оберіть іншу:";
  return "Sorry, no available slots for this date. Pick another:";
}

export function consentMessage(lang: string) {
  if (lang === "uk") {
    return "📋 Натискаючи 'Підтвердити', ви погоджуєтесь, що ваше ім'я, телефон та дані запису будуть збережені для управління візитами та нагадувань.";
  }
  return "📋 By pressing 'Confirm', you agree that your name, phone, and appointment data will be stored for managing visits and reminders.";
}

export function clientCancelledNotifyOwner(
  data: { clientName: string; date: Date; serviceName: string; timezone?: string; reason?: string }
) {
  const tz = data.timezone || "Europe/Kyiv";
  const dateStr = fmtDate(data.date, tz, "uk");
  const reasonLine = data.reason ? `\n💬 Причина: ${data.reason}` : "";
  return `⚠️ Клієнт <b>${data.clientName}</b> скасував запис\n📅 ${data.serviceName}\n📆 ${dateStr}${reasonLine}`;
}

export function ownerCancelledNotifyClient(
  lang: string,
  data: { date: Date; serviceName: string; timezone?: string; reason?: string }
) {
  const tz = data.timezone || "Europe/Kyiv";
  const dateStr = fmtDate(data.date, tz, lang);
  const reasonLine = data.reason
    ? (lang === "uk" ? `\n💬 Причина: ${data.reason}` : `\n💬 Reason: ${data.reason}`)
    : "";

  if (lang === "uk") {
    return "😔 На жаль, ваш запис було скасовано\n" +
      `📅 ${data.serviceName}\n📆 ${dateStr}${reasonLine}\n\n` +
      "Вибачте за незручності. Будь ласка, запишіться на інший час:\n/book";
  }
  return "😔 Unfortunately, your appointment has been cancelled\n" +
    `📅 ${data.serviceName}\n📆 ${dateStr}${reasonLine}\n\n` +
    "We apologize for the inconvenience. Please reschedule:\n/book";
}

export function clientConfirmedNotifyOwner(
  data: { clientName: string; date: Date; serviceName: string; timezone?: string }
) {
  const tz = data.timezone || "Europe/Kyiv";
  const dateStr = fmtDate(data.date, tz, "uk");
  return `✅ Клієнт <b>${data.clientName}</b> підтвердив запис\n📅 ${data.serviceName}\n📆 ${dateStr}`;
}

export function ownerConfirmedNotifyClient(
  lang: string,
  data: { date: Date; serviceName: string; timezone?: string }
) {
  const tz = data.timezone || "Europe/Kyiv";
  const dateStr = fmtDate(data.date, tz, lang);

  if (lang === "uk") {
    return `✅ Ваш запис підтверджено!\n📅 ${data.serviceName}\n📆 ${dateStr}\n\nЧекаємо на вас!`;
  }
  return `✅ Your appointment has been confirmed!\n📅 ${data.serviceName}\n📆 ${dateStr}\n\nSee you there!`;
}
