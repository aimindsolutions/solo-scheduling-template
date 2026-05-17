import { adminDb } from "@/lib/firebase/admin";
import { sendMessage, buildInlineKeyboard } from "./bot";
import { clientCancelledNotifyOwner, ownerCancelledNotifyClient, clientConfirmedNotifyOwner, ownerConfirmedNotifyClient, confirmationMessage } from "./messages";
import { formatInTimeZone } from "@/lib/date-utils";

async function getConfig() {
  const snap = await adminDb.collection("businessConfig").doc("main").get();
  return snap.exists ? snap.data()! : null;
}

function toDate(dt: { toDate: () => Date } | Date): Date {
  return typeof (dt as { toDate?: () => Date }).toDate === "function"
    ? (dt as { toDate: () => Date }).toDate()
    : dt as Date;
}

export async function notifyOwnerOfCancellation(appointment: {
  clientName: string;
  dateTime: { toDate: () => Date } | Date;
  reason?: string;
}) {
  const config = await getConfig();
  if (!config?.ownerTelegramChatId) return;

  const date = toDate(appointment.dateTime);
  const serviceName = config.serviceName || "Appointment";
  const tz = config.timezone || "Europe/Kyiv";

  await sendMessage(
    config.ownerTelegramChatId,
    clientCancelledNotifyOwner({ clientName: appointment.clientName, date, serviceName, timezone: tz, reason: appointment.reason })
  );
}

export async function notifyClientOfCancellation(appointment: {
  clientId: string;
  dateTime: { toDate: () => Date } | Date;
  reason?: string;
}) {
  const config = await getConfig();
  const serviceName = config?.serviceName || "Appointment";
  const tz = config?.timezone || "Europe/Kyiv";

  const clientDoc = await adminDb.collection("clients").doc(appointment.clientId).get();
  if (!clientDoc.exists) return;

  const client = clientDoc.data()!;
  if (!client.telegramChatId) return;

  const lang = client.language || "uk";
  const date = toDate(appointment.dateTime);

  await sendMessage(
    client.telegramChatId,
    ownerCancelledNotifyClient(lang, { date, serviceName, timezone: tz, reason: appointment.reason })
  );
}

export async function notifyOwnerOfConfirmation(appointment: {
  clientName: string;
  dateTime: { toDate: () => Date } | Date;
}) {
  const config = await getConfig();
  if (!config?.ownerTelegramChatId) return;

  const date = toDate(appointment.dateTime);
  const serviceName = config.serviceName || "Appointment";
  const tz = config.timezone || "Europe/Kyiv";

  await sendMessage(
    config.ownerTelegramChatId,
    clientConfirmedNotifyOwner({ clientName: appointment.clientName, date, serviceName, timezone: tz })
  );
}

export async function notifyClientOfConfirmation(appointment: {
  clientId: string;
  dateTime: { toDate: () => Date } | Date;
}) {
  const config = await getConfig();
  const serviceName = config?.serviceName || "Appointment";
  const tz = config?.timezone || "Europe/Kyiv";

  const clientDoc = await adminDb.collection("clients").doc(appointment.clientId).get();
  if (!clientDoc.exists) return;

  const client = clientDoc.data()!;
  if (!client.telegramChatId) return;

  const lang = client.language || "uk";
  const date = toDate(appointment.dateTime);

  await sendMessage(
    client.telegramChatId,
    ownerConfirmedNotifyClient(lang, { date, serviceName, timezone: tz })
  );
}

export async function notifyOwnerOfUnverifiedClient(client: {
  name: string;
  phone: string;
}) {
  const config = await getConfig();
  if (!config?.ownerTelegramChatId) return;

  await sendMessage(
    config.ownerTelegramChatId,
    `🆕 Новий клієнт: ${client.name}, ${client.phone} — не підтверджений. Перетелефонуйте для підтвердження.`
  );
}

export async function sendAppointmentConfirmationRequest({
  clientId,
  appointmentId,
  dateTime,
}: {
  clientId: string;
  appointmentId: string;
  dateTime: { toDate: () => Date } | Date;
}): Promise<boolean> {
  const config = await getConfig();
  const serviceName = config?.serviceName || "Appointment";
  const tz = config?.timezone || "Europe/Kyiv";

  const clientDoc = await adminDb.collection("clients").doc(clientId).get();
  if (!clientDoc.exists) return false;
  const client = clientDoc.data()!;
  if (!client.telegramChatId) return false;

  const lang = client.language || "uk";
  const date = toDate(dateTime);

  await sendMessage(
    client.telegramChatId,
    confirmationMessage(lang, { date, serviceName, timezone: tz }),
    {
      replyMarkup: buildInlineKeyboard([
        [
          { text: lang === "uk" ? "✅ Підтвердити" : "✅ Confirm", callbackData: `confirm:${appointmentId}` },
          { text: lang === "uk" ? "❌ Скасувати" : "❌ Cancel", callbackData: `cancel:${appointmentId}` },
        ],
      ]),
    }
  );
  return true;
}

export async function notifyOwnerOfReschedule(appointment: {
  clientName: string;
  oldDateTime: { toDate: () => Date } | Date;
  newDateTime: { toDate: () => Date } | Date;
  phone: string;
}) {
  const config = await getConfig();
  if (!config?.ownerTelegramChatId) return;

  const oldDate = toDate(appointment.oldDateTime);
  const newDate = toDate(appointment.newDateTime);
  const serviceName = config.serviceName || "Appointment";
  const tz = config.timezone || "Europe/Kyiv";
  const oldDateStr = formatInTimeZone(oldDate, tz, "dd.MM.yyyy HH:mm");
  const newDateStr = formatInTimeZone(newDate, tz, "dd.MM.yyyy HH:mm");

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "";
  const buttons = appUrl
    ? buildInlineKeyboard([[{ text: "📋 Адмін-панель", url: `${appUrl}/admin` }]])
    : undefined;

  await sendMessage(
    config.ownerTelegramChatId,
    `🔄 Перенесено!\n👤 ${appointment.clientName}\n📱 ${appointment.phone}\n📅 ${serviceName}\n📆 ${oldDateStr} → ${newDateStr}`,
    { replyMarkup: buttons }
  );
}

export async function notifyOwnerOfNewBooking(appointment: {
  clientName: string;
  dateTime: { toDate: () => Date } | Date;
  phone: string;
  notes?: string | null;
}) {
  const config = await getConfig();
  if (!config?.ownerTelegramChatId) return;

  const date = toDate(appointment.dateTime);
  const serviceName = config.serviceName || "Appointment";
  const tz = config.timezone || "Europe/Kyiv";
  const dateStr = formatInTimeZone(date, tz, "dd.MM.yyyy HH:mm");
  const notesLine = appointment.notes ? `\n💬 ${appointment.notes}` : "";

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "";
  const buttons = appUrl
    ? buildInlineKeyboard([[{ text: "📋 Адмін-панель", url: `${appUrl}/admin` }]])
    : undefined;

  await sendMessage(
    config.ownerTelegramChatId,
    `📬 Новий запис!\n👤 ${appointment.clientName}\n📱 ${appointment.phone}\n📅 ${serviceName}\n📆 ${dateStr}${notesLine}`,
    { replyMarkup: buttons }
  );
}
