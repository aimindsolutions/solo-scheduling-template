import ical, { ICalAlarmType } from "ical-generator";
import { format } from "date-fns";

interface CalendarEventParams {
  title: string;
  startTime: Date;
  durationMinutes: number;
  description?: string;
  location?: string;
}

export function generateIcsFile(params: CalendarEventParams): string {
  const { title, startTime, durationMinutes, description, location } = params;

  const endTime = new Date(startTime.getTime() + durationMinutes * 60 * 1000);

  const calendar = ical({ name: title });

  const event = calendar.createEvent({
    start: startTime,
    end: endTime,
    summary: title,
    description,
    location,
  });

  event.createAlarm({
    type: ICalAlarmType.display,
    trigger: 24 * 60 * 60,
    description: `Reminder: ${title} tomorrow`,
  });

  event.createAlarm({
    type: ICalAlarmType.display,
    trigger: 2 * 60 * 60,
    description: `Reminder: ${title} in 2 hours`,
  });

  return calendar.toString();
}

export function generateGoogleCalendarUrl(params: CalendarEventParams): string {
  const { title, startTime, durationMinutes, description, location } = params;

  const endTime = new Date(startTime.getTime() + durationMinutes * 60 * 1000);

  const formatDate = (date: Date) =>
    format(date, "yyyyMMdd'T'HHmmss");

  const url = new URL("https://calendar.google.com/calendar/render");
  url.searchParams.set("action", "TEMPLATE");
  url.searchParams.set("text", title);
  url.searchParams.set("dates", `${formatDate(startTime)}/${formatDate(endTime)}`);

  if (description) {
    url.searchParams.set("details", description);
  }
  if (location) {
    url.searchParams.set("location", location);
  }

  return url.toString();
}
