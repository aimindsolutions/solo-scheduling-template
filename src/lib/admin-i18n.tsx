"use client";

import React, { createContext, useContext, useState, useEffect } from "react";

export type AdminLocale = "en" | "uk";

const STORAGE_KEY = "admin_lang";

export type AdminT = {
  // Layout / nav
  adminPanel: string;
  admin: string;
  dashboard: string;
  calendar: string;
  clients: string;
  settings: string;
  theme: string;
  signOut: string;
  loading: string;
  // Status labels
  statusLabels: Record<string, string>;
  // Common actions
  back: string;
  cancel: string;
  save: string;
  saving: string;
  delete: string;
  confirm: string;
  edit: string;
  complete: string;
  noShow: string;
  min: string;
  // Dashboard page
  showCancelled: string;
  hideCancelled: string;
  todaysAppointments: string;
  noAppointmentsToday: string;
  upcoming: string;
  noUpcomingAppointments: string;
  loadMore: string;
  loadingMore: string;
  // Dashboard card labels (keyed by card key)
  cardLabels: Record<string, string>;
  // Appointment detail fields
  field_status: string;
  field_dateTime: string;
  field_duration: string;
  field_phone: string;
  field_source: string;
  field_notes: string;
  field_created: string;
  // Confirm action dialog
  confirmAction: string;
  confirmAppointment: string;
  markCompleted: string;
  markNoShow: string;
  cancelConfirmText: string;
  cancelAppointment: string;
  // Calendar page
  noAppointments: string;
  weekdays: string[];
  // Clients list page
  searchPlaceholder: string;
  col_name: string;
  col_phone: string;
  col_visits: string;
  col_reliability: string;
  noClientsFound: string;
  badge_unreliable: string;
  badge_oftenCancels: string;
  badge_reliable: string;
  badge_unverified: string;
  badge_noReminders: string;
  visitsLabel: (n: number) => string;
  // Client detail page
  clientNotFound: string;
  book: string;
  contactInfo: string;
  firstName: string;
  lastName: string;
  email: string;
  emailLabel: string;
  phoneLabel: string;
  telegramLabel: string;
  telegramConnected: string;
  telegramNotConnected: string;
  clientSince: string;
  confirmPhone: string;
  confirmingPhone: string;
  phoneConfirmed: string;
  generateTelegramLink: string;
  telegramLinkTitle: string;
  telegramLinkCopy: string;
  telegramLinkCopied: string;
  statistics: string;
  stat_total: string;
  stat_confirmed: string;
  stat_cancelled: string;
  stat_noShow: string;
  additionalInfo: string;
  adminNotesPlaceholder: string;
  saveNotes: string;
  appointmentHistory: string;
  pastLabel: string;
  via: string;
  deleteClient: string;
  deleteClientConfirm: (name: string) => string;
  cancelAptTitle: string;
  cancelAptText: string;
  cancelling: string;
  deleteRecord: string;
  deleteRecordText: string;
  deleting: string;
  reschedule: string;
  rescheduleTitle: string;
  current: string;
  pickTime: string;
  loadingSlots: string;
  noSlots: string;
  bookFor: (name: string) => string;
  selectedCount: (n: number) => string;
  requireConfirmation: string;
  bookBtn: (n: number) => string;
  failedToBook: string;
  // Settings page
  businessInfo: string;
  businessName: string;
  serviceName: string;
  defaultDuration: string;
  timezone: string;
  workingHours: string;
  dayOff: string;
  breakTimes: string;
  addBreak: string;
  noBreaks: string;
  vacationDays: string;
  addVacation: string;
  noVacations: string;
  startDate: string;
  endDate: string;
  reason: string;
  reasonOptional: string;
  dashboardCardsTitle: string;
  dashboardCardsHint: string;
  cardOptLabels: Record<string, string>;
  settingsSaved: string;
  settingsFailed: string;
  saveSettings: string;
};

const en: AdminT = {
  adminPanel: "Admin Panel",
  admin: "Admin",
  dashboard: "Dashboard",
  calendar: "Calendar",
  clients: "Clients",
  settings: "Settings",
  theme: "Theme",
  signOut: "Sign Out",
  loading: "Loading...",
  statusLabels: {
    booked: "booked",
    confirmed: "confirmed",
    cancelled: "cancelled",
    completed: "completed",
    no_show: "no show",
  },
  back: "Back",
  cancel: "Cancel",
  save: "Save",
  saving: "Saving...",
  delete: "Delete",
  confirm: "Confirm",
  edit: "Edit",
  complete: "Complete",
  noShow: "No Show",
  min: "min",
  showCancelled: "Show cancelled",
  hideCancelled: "Hide cancelled",
  todaysAppointments: "Today's Appointments",
  noAppointmentsToday: "No appointments today",
  upcoming: "Upcoming",
  noUpcomingAppointments: "No upcoming appointments",
  loadMore: "Load more appointments",
  loadingMore: "Loading…",
  cardLabels: {
    today_all: "Today",
    today_confirmed: "Today confirmed",
    today_booked: "Today pending",
    today_cancelled: "Today cancelled",
    week_all: "This week",
    week_confirmed: "Week confirmed",
    week_booked: "Week pending",
    month_all: "This month",
    month_confirmed: "Month confirmed",
    month_booked: "Month pending",
    upcoming_all: "Upcoming",
    upcoming_confirmed: "Upcoming confirmed",
    upcoming_booked: "Upcoming pending",
  },
  field_status: "Status",
  field_dateTime: "Date & Time",
  field_duration: "Duration",
  field_phone: "Phone",
  field_source: "Source",
  field_notes: "Notes",
  field_created: "Created",
  confirmAction: "Confirm Action",
  confirmAppointment: "Confirm this appointment?",
  markCompleted: "Mark as completed?",
  markNoShow: "Mark as no-show?",
  cancelConfirmText: "Cancel this appointment? The client will be notified.",
  cancelAppointment: "Cancel Appointment",
  noAppointments: "No appointments",
  weekdays: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
  searchPlaceholder: "Search by name or phone...",
  col_name: "Name",
  col_phone: "Phone",
  col_visits: "Visits",
  col_reliability: "Reliability",
  noClientsFound: "No clients found",
  badge_unreliable: "Unreliable",
  badge_oftenCancels: "Often cancels",
  badge_reliable: "Reliable",
  badge_unverified: "Unverified",
  badge_noReminders: "No reminders",
  visitsLabel: (n) => `${n} visits`,
  clientNotFound: "Client not found",
  book: "Book",
  contactInfo: "Contact Info",
  firstName: "First Name",
  lastName: "Last Name",
  email: "Email",
  emailLabel: "Email: ",
  phoneLabel: "Phone: ",
  telegramLabel: "Telegram: ",
  telegramConnected: "connected",
  telegramNotConnected: "not connected",
  clientSince: "Client since: ",
  confirmPhone: "Confirm phone",
  confirmingPhone: "Confirming...",
  phoneConfirmed: "Phone confirmed",
  generateTelegramLink: "Generate Telegram link",
  telegramLinkTitle: "Share this link with the client",
  telegramLinkCopy: "Copy link",
  telegramLinkCopied: "Copied!",
  statistics: "Statistics",
  stat_total: "Total",
  stat_confirmed: "Confirmed",
  stat_cancelled: "Cancelled",
  stat_noShow: "No-show",
  additionalInfo: "Notes",
  adminNotesPlaceholder: "Admin notes about this client...",
  saveNotes: "Save Notes",
  appointmentHistory: "Appointment History",
  pastLabel: "(past)",
  via: "via",
  deleteClient: "Delete Client",
  deleteClientConfirm: (name) => `Permanently delete ${name}? This cannot be undone.`,
  cancelAptTitle: "Cancel Appointment",
  cancelAptText: "Cancel this appointment? The client will be notified via Telegram.",
  cancelling: "Cancelling...",
  deleteRecord: "Delete Record",
  deleteRecordText: "Permanently delete this appointment record from the database? This cannot be undone.",
  deleting: "Deleting...",
  reschedule: "Reschedule",
  rescheduleTitle: "Reschedule Appointment",
  current: "Current: ",
  pickTime: "pick a time",
  loadingSlots: "Loading slots…",
  noSlots: "No available slots on this day.",
  bookFor: (name) => `Book for ${name}`,
  selectedCount: (n) => `Selected (${n})`,
  requireConfirmation: "Require confirmation from client",
  bookBtn: (n) => n > 0 ? `Book (${n})` : "Book",
  failedToBook: "Failed to book appointments",
  businessInfo: "Business Info",
  businessName: "Business Name",
  serviceName: "Service Name",
  defaultDuration: "Default Duration (minutes)",
  timezone: "Timezone",
  workingHours: "Working Hours",
  dayOff: "Day off",
  breakTimes: "Break Times",
  addBreak: "Add Break",
  noBreaks: "No breaks configured",
  vacationDays: "Vacation Days",
  addVacation: "Add Vacation",
  noVacations: "No vacation days configured",
  startDate: "Start Date",
  endDate: "End Date",
  reason: "Reason",
  reasonOptional: "Reason (optional)",
  dashboardCardsTitle: "Dashboard Cards",
  dashboardCardsHint: "Choose which stat cards to show on the dashboard. Min 2.",
  cardOptLabels: {
    today_all: "Today — all",
    today_confirmed: "Today — confirmed",
    today_booked: "Today — pending (not confirmed)",
    today_cancelled: "Today — cancelled",
    week_all: "This week — all",
    week_confirmed: "This week — confirmed",
    week_booked: "This week — pending",
    month_all: "This month — all",
    month_confirmed: "This month — confirmed",
    month_booked: "This month — pending",
    upcoming_all: "All upcoming",
    upcoming_confirmed: "All upcoming — confirmed",
    upcoming_booked: "All upcoming — pending",
  },
  settingsSaved: "Settings saved!",
  settingsFailed: "Failed to save settings",
  saveSettings: "Save Settings",
};

const uk: AdminT = {
  adminPanel: "Адмін-панель",
  admin: "Адмін",
  dashboard: "Дашборд",
  calendar: "Календар",
  clients: "Клієнти",
  settings: "Налаштування",
  theme: "Тема",
  signOut: "Вийти",
  loading: "Завантаження...",
  statusLabels: {
    booked: "очікує",
    confirmed: "підтверджено",
    cancelled: "скасовано",
    completed: "завершено",
    no_show: "не з'явився",
  },
  back: "Назад",
  cancel: "Скасувати",
  save: "Зберегти",
  saving: "Збереження...",
  delete: "Видалити",
  confirm: "Підтвердити",
  edit: "Редагувати",
  complete: "Завершити",
  noShow: "Не з'явився",
  min: "хв",
  showCancelled: "Показати скасовані",
  hideCancelled: "Приховати скасовані",
  todaysAppointments: "Записи сьогодні",
  noAppointmentsToday: "Сьогодні записів немає",
  upcoming: "Майбутні",
  noUpcomingAppointments: "Немає майбутніх записів",
  loadMore: "Завантажити ще",
  loadingMore: "Завантаження…",
  cardLabels: {
    today_all: "Сьогодні",
    today_confirmed: "Підтверджено сьогодні",
    today_booked: "Очікує сьогодні",
    today_cancelled: "Скасовано сьогодні",
    week_all: "Цей тиждень",
    week_confirmed: "Підтверджено за тиждень",
    week_booked: "Очікує за тиждень",
    month_all: "Цей місяць",
    month_confirmed: "Підтверджено за місяць",
    month_booked: "Очікує за місяць",
    upcoming_all: "Майбутні",
    upcoming_confirmed: "Підтверджені майбутні",
    upcoming_booked: "Майбутні в очікуванні",
  },
  field_status: "Статус",
  field_dateTime: "Дата та час",
  field_duration: "Тривалість",
  field_phone: "Телефон",
  field_source: "Джерело",
  field_notes: "Нотатки",
  field_created: "Створено",
  confirmAction: "Підтвердити дію",
  confirmAppointment: "Підтвердити запис?",
  markCompleted: "Позначити як завершений?",
  markNoShow: "Позначити як не з'явився?",
  cancelConfirmText: "Скасувати запис? Клієнта буде повідомлено.",
  cancelAppointment: "Скасувати запис",
  noAppointments: "Немає записів",
  weekdays: ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Нд"],
  searchPlaceholder: "Пошук за ім'ям або телефоном...",
  col_name: "Ім'я",
  col_phone: "Телефон",
  col_visits: "Візити",
  col_reliability: "Надійність",
  noClientsFound: "Клієнтів не знайдено",
  badge_unreliable: "Ненадійний",
  badge_oftenCancels: "Часто скасовує",
  badge_reliable: "Надійний",
  badge_unverified: "Не верифікований",
  badge_noReminders: "Без нагадувань",
  visitsLabel: (n) => `${n} візитів`,
  clientNotFound: "Клієнт не знайдений",
  book: "Записати",
  contactInfo: "Контактна інформація",
  firstName: "Ім'я",
  lastName: "Прізвище",
  email: "Пошта",
  emailLabel: "Пошта: ",
  phoneLabel: "Телефон: ",
  telegramLabel: "Telegram: ",
  telegramConnected: "підключено",
  telegramNotConnected: "не підключено",
  clientSince: "Клієнт з: ",
  confirmPhone: "Підтвердити телефон",
  confirmingPhone: "Підтвердження...",
  phoneConfirmed: "Телефон підтверджено",
  generateTelegramLink: "Згенерувати посилання Telegram",
  telegramLinkTitle: "Поділіться цим посиланням з клієнтом",
  telegramLinkCopy: "Копіювати посилання",
  telegramLinkCopied: "Скопійовано!",
  statistics: "Статистика",
  stat_total: "Усього",
  stat_confirmed: "Підтверджено",
  stat_cancelled: "Скасовано",
  stat_noShow: "Не з'явився",
  additionalInfo: "Нотатки",
  adminNotesPlaceholder: "Нотатки про клієнта...",
  saveNotes: "Зберегти нотатки",
  appointmentHistory: "Історія записів",
  pastLabel: "(минулий)",
  via: "через",
  deleteClient: "Видалити клієнта",
  deleteClientConfirm: (name) => `Назавжди видалити ${name}? Це неможливо скасувати.`,
  cancelAptTitle: "Скасувати запис",
  cancelAptText: "Скасувати запис? Клієнта буде повідомлено в Telegram.",
  cancelling: "Скасування...",
  deleteRecord: "Видалити запис",
  deleteRecordText: "Назавжди видалити цей запис з бази даних? Це неможливо скасувати.",
  deleting: "Видалення...",
  reschedule: "Перенести",
  rescheduleTitle: "Перенести запис",
  current: "Поточний: ",
  pickTime: "виберіть час",
  loadingSlots: "Завантаження часів…",
  noSlots: "Немає вільних слотів.",
  bookFor: (name) => `Запис для ${name}`,
  selectedCount: (n) => `Вибрано (${n})`,
  requireConfirmation: "Потрібне підтвердження від клієнта",
  bookBtn: (n) => n > 0 ? `Записати (${n})` : "Записати",
  failedToBook: "Помилка бронювання",
  businessInfo: "Інформація про бізнес",
  businessName: "Назва бізнесу",
  serviceName: "Назва послуги",
  defaultDuration: "Тривалість за замовчуванням (хв)",
  timezone: "Часовий пояс",
  workingHours: "Робочі години",
  dayOff: "Вихідний",
  breakTimes: "Перерви",
  addBreak: "Додати перерву",
  noBreaks: "Перерви не налаштовані",
  vacationDays: "Відпустка",
  addVacation: "Додати відпустку",
  noVacations: "Відпустка не налаштована",
  startDate: "Дата початку",
  endDate: "Дата кінця",
  reason: "Причина",
  reasonOptional: "Причина (необов'язково)",
  dashboardCardsTitle: "Картки дашборду",
  dashboardCardsHint: "Виберіть картки для відображення. Мінімум 2.",
  cardOptLabels: {
    today_all: "Сьогодні — всі",
    today_confirmed: "Сьогодні — підтверджені",
    today_booked: "Сьогодні — очікують",
    today_cancelled: "Сьогодні — скасовані",
    week_all: "Цей тиждень — всі",
    week_confirmed: "Цей тиждень — підтверджені",
    week_booked: "Цей тиждень — очікують",
    month_all: "Цей місяць — всі",
    month_confirmed: "Цей місяць — підтверджені",
    month_booked: "Цей місяць — очікують",
    upcoming_all: "Всі майбутні",
    upcoming_confirmed: "Майбутні — підтверджені",
    upcoming_booked: "Майбутні — очікують",
  },
  settingsSaved: "Налаштування збережені!",
  settingsFailed: "Помилка збереження налаштувань",
  saveSettings: "Зберегти налаштування",
};

const translations: Record<AdminLocale, AdminT> = { en, uk };

interface AdminLangContextType {
  locale: AdminLocale;
  setLocale: (l: AdminLocale) => void;
  t: AdminT;
}

const AdminLangContext = createContext<AdminLangContextType>({
  locale: "en",
  setLocale: () => {},
  t: en,
});

export function AdminLangProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<AdminLocale>("en");

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY) as AdminLocale | null;
    if (stored === "en" || stored === "uk") setLocaleState(stored);
  }, []);

  function setLocale(l: AdminLocale) {
    setLocaleState(l);
    localStorage.setItem(STORAGE_KEY, l);
  }

  return (
    <AdminLangContext.Provider value={{ locale, setLocale, t: translations[locale] }}>
      {children}
    </AdminLangContext.Provider>
  );
}

export function useAdminLang() {
  return useContext(AdminLangContext);
}
