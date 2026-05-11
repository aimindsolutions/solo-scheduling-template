import { google } from "googleapis";

const SCOPES = ["https://www.googleapis.com/auth/calendar"];

function getCalendarClient() {
  const auth = new google.auth.JWT({
    email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
    scopes: SCOPES,
  });

  return google.calendar({ version: "v3", auth });
}

const CALENDAR_ID = process.env.GOOGLE_CALENDAR_ID || "primary";

const COLOR_BOOKED = "6";    // orange
const COLOR_CONFIRMED = "10"; // green

export async function createCalendarEvent(params: {
  summary: string;
  startTime: Date;
  durationMinutes: number;
  description?: string;
  timeZone?: string;
}) {
  const calendar = getCalendarClient();
  const endTime = new Date(
    params.startTime.getTime() + params.durationMinutes * 60 * 1000
  );
  const tz = params.timeZone || "Europe/Kyiv";

  const event = await calendar.events.insert({
    calendarId: CALENDAR_ID,
    requestBody: {
      summary: params.summary,
      description: params.description,
      start: { dateTime: params.startTime.toISOString(), timeZone: tz },
      end: { dateTime: endTime.toISOString(), timeZone: tz },
      colorId: COLOR_BOOKED,
    },
  });

  return event.data.id || undefined;
}

export async function confirmCalendarEvent(eventId: string) {
  const calendar = getCalendarClient();

  await calendar.events.patch({
    calendarId: CALENDAR_ID,
    eventId,
    requestBody: { colorId: COLOR_CONFIRMED },
  });
}

export async function deleteCalendarEvent(eventId: string) {
  const calendar = getCalendarClient();

  await calendar.events.delete({
    calendarId: CALENDAR_ID,
    eventId,
  });
}

export async function updateCalendarEvent(
  eventId: string,
  params: {
    summary?: string;
    startTime?: Date;
    durationMinutes?: number;
    description?: string;
  }
) {
  const calendar = getCalendarClient();

  const requestBody: Record<string, unknown> = {};
  if (params.summary) requestBody.summary = params.summary;
  if (params.description) requestBody.description = params.description;
  if (params.startTime && params.durationMinutes) {
    const endTime = new Date(
      params.startTime.getTime() + params.durationMinutes * 60 * 1000
    );
    requestBody.start = { dateTime: params.startTime.toISOString() };
    requestBody.end = { dateTime: endTime.toISOString() };
  }

  await calendar.events.patch({
    calendarId: CALENDAR_ID,
    eventId,
    requestBody,
  });
}

export async function listCalendarEvents(timeMin: Date, timeMax: Date) {
  const calendar = getCalendarClient();

  const response = await calendar.events.list({
    calendarId: CALENDAR_ID,
    timeMin: timeMin.toISOString(),
    timeMax: timeMax.toISOString(),
    singleEvents: true,
    orderBy: "startTime",
  });

  return response.data.items || [];
}
