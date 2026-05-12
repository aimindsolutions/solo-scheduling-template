import { adminDb } from "@/lib/firebase/admin";
import { sendMessage, buildInlineKeyboard } from "./bot";
import { clientCancelledNotifyOwner, ownerCancelledNotifyClient, clientConfirmedNotifyOwner, ownerConfirmedNotifyClient } from "./messages";
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
}) {
  const config = await getConfig();
  if (!config?.ownerTelegramChatId) return;

  const date = toDate(appointment.dateTime);
  const serviceName = config.serviceName || "Appointment";
  const tz = config.timezone || "Europe/Kyiv";

  await sendMessage(
    config.ownerTelegramChatId,
    clientCancelledNotifyOwner({ clientName: appointment.clientName, date, serviceName, timezone: tz })
  );
}

export async function notifyClientOfCancellation(appointment: {
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
    ownerCancelledNotifyClient(lang, { date, serviceName, timezone: tz })
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
