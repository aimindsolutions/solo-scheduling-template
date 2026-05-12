import { parse, format, addMinutes, isBefore, isAfter, startOfDay } from "date-fns";
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

export function getAvailableSlots(
  date: Date,
  config: BusinessConfig,
  existingAppointments: Appointment[],
  now?: Date
): string[] {
  const dayName = DAYS_OF_WEEK[date.getDay()];
  const daySchedule = config.workingHours[dayName];

  if (!daySchedule) return [];

  const { start, end } = daySchedule;
  const duration = config.defaultDurationMinutes;
  const dayStart = startOfDay(date);
  const currentTime = now || new Date();

  const workStart = parse(start, "HH:mm", dayStart);
  const workEnd = parse(end, "HH:mm", dayStart);

  const bookedSlots = existingAppointments
    .filter((apt) => apt.status !== "cancelled")
    .map((apt) => {
      const aptStart = apt.dateTime instanceof Date ? apt.dateTime : apt.dateTime.toDate();
      const aptEnd = addMinutes(aptStart, apt.durationMinutes);
      return { start: aptStart, end: aptEnd };
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

export function getDaysWithAvailability(
  startDate: Date,
  daysAhead: number,
  config: BusinessConfig
): string[] {
  const available: string[] = [];

  for (let i = 0; i < daysAhead; i++) {
    const date = new Date(startDate);
    date.setDate(date.getDate() + i);

    const dayName = DAYS_OF_WEEK[date.getDay()];
    if (config.workingHours[dayName]) {
      available.push(format(date, "yyyy-MM-dd"));
    }
  }

  return available;
}
