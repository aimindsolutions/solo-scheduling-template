import { Timestamp } from "firebase/firestore";

export type AuthMethod = "phone_telegram" | "google" | "email_magic";

export interface ClientSession {
  clientId: string;
  createdAt: Timestamp | Date;
  expiresAt: Timestamp | Date;
  authMethod: AuthMethod;
  rememberMe: boolean;
  ipHash: string;
}

export interface PhoneVerifyToken {
  phone: string;
  clientId?: string;
  registrationData?: {
    name: string;
    email?: string;
    consentText: string;
    consentTimestamp: Timestamp | Date;
  };
  createdAt: Timestamp | Date;
  expiresAt: Timestamp | Date;
  used: boolean;
}

export interface AuthRateLimit {
  key: string;
  attempts: number;
  windowStart: Timestamp | Date;
  blockedUntil?: Timestamp | Date;
  expiresAt: Timestamp | Date;
}

export interface VacationDay {
  id: string;
  startDate: string;
  endDate: string;
  reason?: string;
}

export interface BusinessConfig {
  businessName: string;
  serviceName: string;
  defaultDurationMinutes: number;
  workingHours: {
    [day: string]: { start: string; end: string } | null;
  };
  breakSlots: { start: string; end: string }[];
  vacationDays?: VacationDay[];
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
  consentText?: string;
  totalAppointments: number;
  confirmedAppointments: number;
  cancelledAppointments: number;
  noShowAppointments: number;
  createdAt: Timestamp | Date;
  updatedAt: Timestamp | Date;
  // Client auth fields
  emailVerified?: boolean;
  phoneVerified?: boolean;
  googleId?: string;
  authMethods?: AuthMethod[];
  preferredChannel?: "telegram" | "email";
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
