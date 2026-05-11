import { format } from "date-fns";
import { uk, enUS } from "date-fns/locale";

const localeMap = { uk, en: enUS } as const;

function getLocale(lang: string) {
  return localeMap[lang as keyof typeof localeMap] || uk;
}

export function confirmationMessage(
  lang: string,
  data: { date: Date; serviceName: string }
) {
  const dateStr = format(data.date, "d MMMM yyyy, HH:mm", {
    locale: getLocale(lang),
  });

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
  data: { date: Date; serviceName: string; hoursLeft: number }
) {
  const dateStr = format(data.date, "d MMMM, HH:mm", {
    locale: getLocale(lang),
  });

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
  data: { date: Date; serviceName: string }
) {
  const dateStr = format(data.date, "d MMMM yyyy, HH:mm", {
    locale: getLocale(lang),
  });

  if (lang === "uk") {
    return `✅ Запис створено!\n\n📅 ${data.serviceName}\n📆 ${dateStr}\n\nДодайте запис у свій календар:`;
  }
  return `✅ Appointment booked!\n\n📅 ${data.serviceName}\n📆 ${dateStr}\n\nAdd to your calendar:`;
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
