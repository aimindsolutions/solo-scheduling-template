import { Timestamp } from "firebase/firestore";

export interface BusinessConfig {
  businessName: string;
  serviceName: string;
  defaultDurationMinutes: number;
  workingHours: {
    [day: string]: { start: string; end: string } | null;
  };
  breakSlots: { start: string; end: string }[];
  ownerEmail: string;
  ownerTelegramChatId?: string;
  googleCalendarId: string;
  timezone: string;
  languages: string[];
  jurisdiction: "UA" | "BG";
}

export interface Client {
  id?: string;
  firstName: string;
  lastName?: string;
  phone: string;
  email?: string;
  telegramChatId?: string;
  language?: string;
  consentGiven: boolean;
  consentTimestamp: Timestamp | Date;
  consentLanguage: string;
  consentJurisdiction: "UA" | "BG";
  totalAppointments: number;
  confirmedAppointments: number;
  cancelledAppointments: number;
  noShowAppointments: number;
  createdAt: Timestamp | Date;
  updatedAt: Timestamp | Date;
}

export type AppointmentStatus =
  | "booked"
  | "confirmed"
  | "cancelled"
  | "completed"
  | "no_show";

export type AppointmentSource = "web" | "telegram" | "admin";

export interface Appointment {
  id?: string;
  clientId: string;
  clientName: string;
  clientPhone: string;
  dateTime: Timestamp | Date;
  durationMinutes: number;
  status: AppointmentStatus;
  source: AppointmentSource;
  googleCalendarEventId?: string;
  reminder24hSent: boolean;
  reminder2hSent: boolean;
  notes?: string;
  createdAt: Timestamp | Date;
  updatedAt: Timestamp | Date;
}

export interface TimeSlot {
  start: string;
  end: string;
}

export interface BookingFormData {
  firstName: string;
  lastName?: string;
  phone: string;
  email?: string;
  notes?: string;
  date: string;
  time: string;
  consentGiven: boolean;
}
