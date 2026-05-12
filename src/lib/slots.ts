import { parse, format, addMinutes, isBefore, isAfter, startOfDay, endOfDay } from "date-fns";
import { parseInTimeZone, formatInTimeZone, startOfDayInTimeZone, endOfDayInTimeZone } from "@/lib/date-utils";
import type { BusinessConfig, Appointment } from "@/types";

const DAYS_OF_WEEK = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
];

/**
 * Compute available time slots for a given date.
 * `date` is a naive Date representing the calendar day (used only for day-of-week).
 * `nowLocal` should be a fake-local Date representing "now" in business timezone coordinates
 * (e.g. if it's 16:46 Kyiv, pass a Date whose hours=16, minutes=46).
 */
export function getAvailableSlots(
  date: Date,
  config: BusinessConfig,
  existingAppointments: Appointment[],
  nowLocal?: Date
): string[] {
  const dayName = DAYS_OF_WEEK[date.getDay()];
  const daySchedule = config.workingHours[dayName];

  if (!daySchedule) return [];

  const tz = config.timezone || "Europe/Kyiv";

  if (config.vacationDays) {
    const dateStr = format(date, "yyyy-MM-dd");
    const isVacation = config.vacationDays.some(
      (v) => dateStr >= v.startDate && dateStr <= v.endDate
    );
    if (isVacation) return [];
  }

  const { start, end } = daySchedule;
  const duration = config.defaultDurationMinutes;
  const dayStart = startOfDay(date);
  const currentTime = nowLocal || new Date();

  const workStart = parse(start, "HH:mm", dayStart);
  const workEnd = parse(end, "HH:mm", dayStart);

  const bookedSlots = existingAppointments
    .filter((apt) => apt.status !== "cancelled")
    .map((apt) => {
      const aptStartUtc = apt.dateTime instanceof Date ? apt.dateTime : (apt.dateTime as { toDate: () => Date }).toDate();
      const aptLocalTime = formatInTimeZone(aptStartUtc, tz, "HH:mm");
      const aptLocalStart = parse(aptLocalTime, "HH:mm", dayStart);
      const aptEnd = addMinutes(aptLocalStart, apt.durationMinutes);
      return { start: aptLocalStart, end: aptEnd };
    });

  const breakSlots = (config.breakSlots || []).map((b) => ({
    start: parse(b.start, "HH:mm", dayStart),
    end: parse(b.end, "HH:mm", dayStart),
  }));

  const slots: string[] = [];
  let current = workStart;

  while (!isAfter(addMinutes(current, duration), workEnd)) {
    const slotEnd = addMinutes(current, duration);

    const isPast = isBefore(current, currentTime);

    const isBreak = breakSlots.some(
      (b) => isBefore(current, b.end) && isAfter(slotEnd, b.start)
    );

    const isBooked = bookedSlots.some(
      (b) => isBefore(current, b.end) && isAfter(slotEnd, b.start)
    );

    if (!isPast && !isBreak && !isBooked) {
      slots.push(format(current, "HH:mm"));
    }

    current = addMinutes(current, duration);
  }

  return slots;
}

/**
 * Build a fake-local "now" Date in the same coordinate system slots use.
 * Slots are parsed onto startOfDay(date), so we need "now" expressed
 * as hours:minutes in the business timezone, placed onto the same day anchor.
 */
export function getNowLocalForSlots(date: Date, tz: string): Date {
  const nowTimeStr = formatInTimeZone(new Date(), tz, "HH:mm");
  const todayStr = formatInTimeZone(new Date(), tz, "yyyy-MM-dd");
  const dateStr = format(date, "yyyy-MM-dd");
  if (dateStr !== todayStr) {
    return startOfDay(date);
  }
  return parse(nowTimeStr, "HH:mm", startOfDay(date));
}

export function getDaysWithAvailability(
  startDate: Date,
  daysAhead: number,
  config: BusinessConfig,
  allAppointments?: Appointment[]
): string[] {
  const available: string[] = [];
  const tz = config.timezone || "Europe/Kyiv";

  for (let i = 0; i < daysAhead; i++) {
    const date = new Date(startDate);
    date.setDate(date.getDate() + i);

    const dayName = DAYS_OF_WEEK[date.getDay()];
    if (!config.workingHours[dayName]) continue;

    const dateStr = format(date, "yyyy-MM-dd");
    if (config.vacationDays) {
      const isVacation = config.vacationDays.some(
        (v) => dateStr >= v.startDate && dateStr <= v.endDate
      );
      if (isVacation) continue;
    }

    if (allAppointments) {
      const dayAppointments = allAppointments.filter((apt) => {
        const aptTime = apt.dateTime instanceof Date ? apt.dateTime : (apt.dateTime as { toDate: () => Date }).toDate();
        const aptDateStr = formatInTimeZone(aptTime, tz, "yyyy-MM-dd");
        return aptDateStr === dateStr;
      });
      const nowLocal = getNowLocalForSlots(date, tz);
      const slots = getAvailableSlots(date, config, dayAppointments, nowLocal);
      if (slots.length > 0) {
        available.push(dateStr);
      }
    } else {
      available.push(dateStr);
    }
  }

  return available;
}
