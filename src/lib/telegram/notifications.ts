import { adminDb } from "@/lib/firebase/admin";
import { sendMessage } from "./bot";
import { clientCancelledNotifyOwner, ownerCancelledNotifyClient, clientConfirmedNotifyOwner, ownerConfirmedNotifyClient } from "./messages";

async function getConfig() {
  const snap = await adminDb.collection("businessConfig").doc("main").get();
  return snap.exists ? snap.data()! : null;
}

export async function notifyOwnerOfCancellation(appointment: {
  clientName: string;
  dateTime: { toDate: () => Date } | Date;
}) {
  const config = await getConfig();
  if (!config?.ownerTelegramChatId) return;

  const date = typeof (appointment.dateTime as { toDate?: () => Date }).toDate === "function"
    ? (appointment.dateTime as { toDate: () => Date }).toDate()
    : appointment.dateTime as Date;

  const serviceName = config.serviceName || "Appointment";

  await sendMessage(
    config.ownerTelegramChatId,
    clientCancelledNotifyOwner({ clientName: appointment.clientName, date, serviceName })
  );
}

export async function notifyClientOfCancellation(appointment: {
  clientId: string;
  dateTime: { toDate: () => Date } | Date;
}) {
  const config = await getConfig();
  const serviceName = config?.serviceName || "Appointment";

  const clientDoc = await adminDb.collection("clients").doc(appointment.clientId).get();
  if (!clientDoc.exists) return;

  const client = clientDoc.data()!;
  if (!client.telegramChatId) return;

  const lang = client.language || "uk";
  const date = typeof (appointment.dateTime as { toDate?: () => Date }).toDate === "function"
    ? (appointment.dateTime as { toDate: () => Date }).toDate()
    : appointment.dateTime as Date;

  await sendMessage(
    client.telegramChatId,
    ownerCancelledNotifyClient(lang, { date, serviceName })
  );
}

export async function notifyOwnerOfConfirmation(appointment: {
  clientName: string;
  dateTime: { toDate: () => Date } | Date;
}) {
  const config = await getConfig();
  if (!config?.ownerTelegramChatId) return;

  const date = typeof (appointment.dateTime as { toDate?: () => Date }).toDate === "function"
    ? (appointment.dateTime as { toDate: () => Date }).toDate()
    : appointment.dateTime as Date;

  const serviceName = config.serviceName || "Appointment";

  await sendMessage(
    config.ownerTelegramChatId,
    clientConfirmedNotifyOwner({ clientName: appointment.clientName, date, serviceName })
  );
}

export async function notifyClientOfConfirmation(appointment: {
  clientId: string;
  dateTime: { toDate: () => Date } | Date;
}) {
  const config = await getConfig();
  const serviceName = config?.serviceName || "Appointment";

  const clientDoc = await adminDb.collection("clients").doc(appointment.clientId).get();
  if (!clientDoc.exists) return;

  const client = clientDoc.data()!;
  if (!client.telegramChatId) return;

  const lang = client.language || "uk";
  const date = typeof (appointment.dateTime as { toDate?: () => Date }).toDate === "function"
    ? (appointment.dateTime as { toDate: () => Date }).toDate()
    : appointment.dateTime as Date;

  await sendMessage(
    client.telegramChatId,
    ownerConfirmedNotifyClient(lang, { date, serviceName })
  );
}

export async function notifyOwnerOfNewBooking(appointment: {
  clientName: string;
  dateTime: { toDate: () => Date } | Date;
  phone: string;
}) {
  const config = await getConfig();
  if (!config?.ownerTelegramChatId) return;

  const date = typeof (appointment.dateTime as { toDate?: () => Date }).toDate === "function"
    ? (appointment.dateTime as { toDate: () => Date }).toDate()
    : appointment.dateTime as Date;

  const serviceName = config.serviceName || "Appointment";
  const dateStr = (await import("date-fns")).format(date, "d MMMM yyyy, HH:mm");

  await sendMessage(
    config.ownerTelegramChatId,
    `📬 Новий запис!\n👤 ${appointment.clientName}\n📱 ${appointment.phone}\n📅 ${serviceName}\n📆 ${dateStr}`
  );
}
