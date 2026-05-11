/**
 * Parse "YYYY-MM-DD HH:mm" as a specific IANA timezone, returning a UTC Date.
 * Vercel runs in UTC, so naive parsing would treat the input as UTC —
 * this ensures 15:00 Europe/Kyiv becomes 12:00 UTC (not 15:00 UTC).
 */
export function parseInTimeZone(dateTimeStr: string, timeZone: string): Date {
  const fakeUtc = new Date(`${dateTimeStr.replace(" ", "T")}:00.000Z`);

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

  const offsetProbe = new Date(fakeUtc);
  const partsInTz = formatter.formatToParts(offsetProbe);
  const get = (type: string) =>
    partsInTz.find((p) => p.type === type)?.value || "0";

  const tzYear = parseInt(get("year"));
  const tzMonth = parseInt(get("month"));
  const tzDay = parseInt(get("day"));
  const tzHour = parseInt(get("hour"));
  const tzMinute = parseInt(get("minute"));

  const inputYear = fakeUtc.getUTCFullYear();
  const inputMonth = fakeUtc.getUTCMonth() + 1;
  const inputDay = fakeUtc.getUTCDate();
  const inputHour = fakeUtc.getUTCHours();
  const inputMinute = fakeUtc.getUTCMinutes();

  const diffMs =
    Date.UTC(tzYear, tzMonth - 1, tzDay, tzHour, tzMinute) -
    Date.UTC(inputYear, inputMonth - 1, inputDay, inputHour, inputMinute);

  return new Date(fakeUtc.getTime() - diffMs);
}
