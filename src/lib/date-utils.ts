/**
 * Parse "YYYY-MM-DD HH:mm" as a specific IANA timezone, returning a UTC Date.
 * Vercel runs in UTC, so naive parsing would treat the input as UTC —
 * this ensures 15:00 Europe/Kyiv becomes 12:00 UTC (not 15:00 UTC).
 */
export function parseInTimeZone(dateTimeStr: string, timeZone: string): Date {
  const fakeUtc = new Date(`${dateTimeStr.replace(" ", "T")}:00.000Z`);

  const diffMs = getTimezoneOffsetMs(fakeUtc, timeZone);

  return new Date(fakeUtc.getTime() - diffMs);
}

/**
 * Format a UTC Date into a string as it would appear in the given IANA timezone.
 * Use this everywhere you display a stored appointment time.
 */
export function formatInTimeZone(
  date: Date | string,
  timeZone: string,
  fmt: "HH:mm" | "dd.MM.yyyy HH:mm" | "dd.MM HH:mm" | "dd.MM.yyyy" | "yyyy-MM-dd" | "HH:mm dd.MM.yyyy"
): string {
  const d = typeof date === "string" ? new Date(date) : date;

  const formatter = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  const parts = formatter.formatToParts(d);
  const get = (type: string) => parts.find((p) => p.type === type)?.value || "00";

  const day = get("day");
  const month = get("month");
  const year = get("year");
  const hour = get("hour");
  const minute = get("minute");

  switch (fmt) {
    case "HH:mm":
      return `${hour}:${minute}`;
    case "dd.MM.yyyy HH:mm":
      return `${day}.${month}.${year} ${hour}:${minute}`;
    case "dd.MM HH:mm":
      return `${day}.${month} ${hour}:${minute}`;
    case "dd.MM.yyyy":
      return `${day}.${month}.${year}`;
    case "yyyy-MM-dd":
      return `${year}-${month}-${day}`;
    case "HH:mm dd.MM.yyyy":
      return `${hour}:${minute} ${day}.${month}.${year}`;
    default:
      return `${day}.${month}.${year} ${hour}:${minute}`;
  }
}

/**
 * Get the start-of-day (00:00) in UTC for a given date string in a timezone.
 * E.g. "2026-05-12" in Europe/Kyiv → 2026-05-11T21:00:00Z
 */
export function startOfDayInTimeZone(dateStr: string, timeZone: string): Date {
  return parseInTimeZone(`${dateStr} 00:00`, timeZone);
}

/**
 * Get the end-of-day (23:59:59.999) in UTC for a given date string in a timezone.
 */
export function endOfDayInTimeZone(dateStr: string, timeZone: string): Date {
  const end = parseInTimeZone(`${dateStr} 23:59`, timeZone);
  return new Date(end.getTime() + 59 * 1000 + 999);
}

/**
 * Get the current time expressed as "HH:mm" in the given timezone.
 */
export function nowInTimeZone(timeZone: string): { date: string; time: string } {
  const now = new Date();
  return {
    date: formatInTimeZone(now, timeZone, "yyyy-MM-dd"),
    time: formatInTimeZone(now, timeZone, "HH:mm"),
  };
}

function getTimezoneOffsetMs(utcDate: Date, timeZone: string): number {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });

  const partsInTz = formatter.formatToParts(utcDate);
  const get = (type: string) =>
    partsInTz.find((p) => p.type === type)?.value || "0";

  const tzYear = parseInt(get("year"));
  const tzMonth = parseInt(get("month"));
  const tzDay = parseInt(get("day"));
  const tzHour = parseInt(get("hour"));
  const tzMinute = parseInt(get("minute"));

  const inputYear = utcDate.getUTCFullYear();
  const inputMonth = utcDate.getUTCMonth() + 1;
  const inputDay = utcDate.getUTCDate();
  const inputHour = utcDate.getUTCHours();
  const inputMinute = utcDate.getUTCMinutes();

  return (
    Date.UTC(tzYear, tzMonth - 1, tzDay, tzHour, tzMinute) -
    Date.UTC(inputYear, inputMonth - 1, inputDay, inputHour, inputMinute)
  );
}

/**
 * Comprehensive list of IANA timezones for the settings dropdown.
 */
export const TIMEZONES = [
  "Pacific/Midway",
  "Pacific/Honolulu",
  "America/Anchorage",
  "America/Los_Angeles",
  "America/Denver",
  "America/Chicago",
  "America/New_York",
  "America/Caracas",
  "America/Halifax",
  "America/St_Johns",
  "America/Sao_Paulo",
  "America/Argentina/Buenos_Aires",
  "Atlantic/South_Georgia",
  "Atlantic/Azores",
  "Atlantic/Cape_Verde",
  "Europe/London",
  "Europe/Lisbon",
  "Europe/Berlin",
  "Europe/Paris",
  "Europe/Rome",
  "Europe/Madrid",
  "Europe/Warsaw",
  "Europe/Prague",
  "Europe/Zurich",
  "Europe/Amsterdam",
  "Europe/Brussels",
  "Europe/Vienna",
  "Europe/Stockholm",
  "Europe/Oslo",
  "Europe/Copenhagen",
  "Europe/Helsinki",
  "Europe/Bucharest",
  "Europe/Sofia",
  "Europe/Athens",
  "Europe/Kyiv",
  "Europe/Istanbul",
  "Europe/Moscow",
  "Europe/Minsk",
  "Europe/Vilnius",
  "Europe/Riga",
  "Europe/Tallinn",
  "Asia/Tbilisi",
  "Asia/Yerevan",
  "Asia/Dubai",
  "Asia/Baku",
  "Asia/Kabul",
  "Asia/Karachi",
  "Asia/Tashkent",
  "Asia/Kolkata",
  "Asia/Kathmandu",
  "Asia/Dhaka",
  "Asia/Almaty",
  "Asia/Bangkok",
  "Asia/Jakarta",
  "Asia/Ho_Chi_Minh",
  "Asia/Shanghai",
  "Asia/Singapore",
  "Asia/Hong_Kong",
  "Asia/Taipei",
  "Asia/Seoul",
  "Asia/Tokyo",
  "Australia/Perth",
  "Australia/Adelaide",
  "Australia/Sydney",
  "Australia/Brisbane",
  "Pacific/Auckland",
  "Pacific/Fiji",
  "Pacific/Tongatapu",
];
