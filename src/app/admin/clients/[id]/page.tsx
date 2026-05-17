"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Pencil, Trash2, Save, X, CalendarPlus, ChevronLeft, ChevronRight,
  Calendar, XCircle,
} from "lucide-react";
import { adminFetch } from "@/lib/api-client";
import { formatInTimeZone } from "@/lib/date-utils";
import {
  format, startOfMonth, endOfMonth, startOfWeek, eachDayOfInterval,
  addMonths, isSameDay, isSameMonth, getDay, addDays,
} from "date-fns";

interface ClientDetail {
  id: string;
  firstName: string;
  lastName?: string;
  phone: string;
  email?: string;
  language?: string;
  telegramChatId?: string;
  adminNotes?: string;
  totalAppointments: number;
  confirmedAppointments: number;
  cancelledAppointments: number;
  noShowAppointments: number;
  createdAt: string;
}

interface AppointmentData {
  id: string;
  dateTime: string;
  durationMinutes: number;
  status: string;
  source: string;
  notes?: string;
}

const statusColor: Record<string, string> = {
  booked: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300",
  confirmed: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  cancelled: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
  completed: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  no_show: "bg-gray-100 text-gray-800 dark:bg-gray-800/30 dark:text-gray-300",
};

// Mini calendar shared by both booking and reschedule dialogs
function MiniCalendar({
  month,
  onMonthChange,
  onDayClick,
  isDayDisabled,
  isDaySelected,
  isDayHighlighted,
  isDayActive,
}: {
  month: Date;
  onMonthChange: (m: Date) => void;
  onDayClick: (dateStr: string) => void;
  isDayDisabled: (day: Date) => boolean;
  isDaySelected?: (dateStr: string) => boolean;
  isDayHighlighted?: (dateStr: string) => boolean;
  isDayActive?: (dateStr: string) => boolean;
}) {
  const monthStart = startOfMonth(month);
  const monthEnd = endOfMonth(month);
  const allDays = eachDayOfInterval({ start: monthStart, end: monthEnd });
  const leading = (getDay(monthStart) + 6) % 7;
  const cells: (Date | null)[] = [...Array(leading).fill(null), ...allDays];
  const rem = cells.length % 7;
  if (rem > 0) cells.push(...Array(7 - rem).fill(null));

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-center gap-2">
        <Button variant="outline" size="icon" onClick={() => onMonthChange(startOfMonth(addMonths(month, -1)))}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="text-sm font-medium min-w-[120px] text-center">{format(month, "MMMM yyyy")}</span>
        <Button variant="outline" size="icon" onClick={() => onMonthChange(startOfMonth(addMonths(month, 1)))}>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
      <div className="grid grid-cols-7 text-center text-xs text-muted-foreground">
        {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => (
          <div key={i} className="py-1">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map((day, i) => {
          if (!day) return <div key={i} />;
          const dateStr = format(day, "yyyy-MM-dd");
          const disabled = isDayDisabled(day);
          const selected = isDaySelected?.(dateStr);
          const highlighted = isDayHighlighted?.(dateStr);
          const active = isDayActive?.(dateStr);
          const today = isSameDay(day, new Date());
          return (
            <button
              key={i}
              disabled={disabled}
              onClick={() => onDayClick(dateStr)}
              className={[
                "aspect-square flex flex-col items-center justify-center rounded text-sm font-medium transition-colors relative",
                disabled ? "text-muted-foreground/40 cursor-not-allowed" : "hover:bg-accent cursor-pointer",
                selected ? "bg-primary text-primary-foreground hover:bg-primary/90" : "",
                active && !selected ? "bg-accent border border-primary" : "",
                today && !selected && !active ? "border border-primary text-primary" : "",
              ].filter(Boolean).join(" ")}
            >
              {format(day, "d")}
              {highlighted && !selected && (
                <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-green-500" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default function ClientDetailPage() {
  const params = useParams();
  const router = useRouter();
  const clientId = params.id as string;
  const [client, setClient] = useState<ClientDetail | null>(null);
  const [appointments, setAppointments] = useState<AppointmentData[]>([]);
  const [timezone, setTimezone] = useState("Europe/Kyiv");
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({ firstName: "", lastName: "", phone: "", email: "" });
  const [notes, setNotes] = useState("");
  const [notesDirty, setNotesDirty] = useState(false);
  const [notesSaving, setNotesSaving] = useState(false);
  const [showDeleteClient, setShowDeleteClient] = useState(false);
  const [saving, setSaving] = useState(false);

  // Appointment action state
  type AptActionType = "reschedule" | "cancel" | "delete";
  const [aptAction, setAptAction] = useState<{ type: AptActionType; apt: AppointmentData } | null>(null);
  const [aptActionSaving, setAptActionSaving] = useState(false);
  // Reschedule sub-state
  const [rescheduleMonth, setRescheduleMonth] = useState(() => startOfMonth(new Date()));
  const [rescheduleDate, setRescheduleDate] = useState<string | null>(null);
  const [rescheduleSlots, setRescheduleSlots] = useState<string[]>([]);
  const [rescheduleLoadingSlots, setRescheduleLoadingSlots] = useState(false);
  const [rescheduleTime, setRescheduleTime] = useState<string | null>(null);

  // Booking dialog state
  const [showBooking, setShowBooking] = useState(false);
  const [bookingMonth, setBookingMonth] = useState(() => startOfMonth(new Date()));
  const [bookingActiveDate, setBookingActiveDate] = useState<string | null>(null);
  const [bookingSlots, setBookingSlots] = useState<string[]>([]);
  const [bookingLoadingSlots, setBookingLoadingSlots] = useState(false);
  const [selectedSlots, setSelectedSlots] = useState<{ date: string; time: string }[]>([]);
  const [requireConfirmation, setRequireConfirmation] = useState(false);
  const [bookingSaving, setBookingSaving] = useState(false);
  const [bookingError, setBookingError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    let c: ClientDetail | null = null;
    try {
      const clientRes = await adminFetch(`/api/clients/${clientId}`);
      const clientData = await clientRes.json();
      c = clientData.client || clientData;
      setClient(c);
      if (c) {
        setEditForm({
          firstName: c.firstName || "",
          lastName: c.lastName || "",
          phone: c.phone || "",
          email: c.email || "",
        });
        setNotes(c.adminNotes || "");
        setNotesDirty(false);
      }
    } catch {
      // client stays null
    } finally {
      setLoading(false);
    }

    if (!c) return;

    try {
      const aptsRes = await adminFetch(`/api/appointments?clientId=${clientId}&limit=200`);
      const aptsData = await aptsRes.json();
      setAppointments(aptsData.appointments || []);
      if (aptsData.timezone) setTimezone(aptsData.timezone);
    } catch {
      // show empty list
    }
  }, [clientId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  async function fetchSlots(dateStr: string, setter: (slots: string[]) => void, loadingSetter: (v: boolean) => void) {
    loadingSetter(true);
    try {
      const res = await fetch(`/api/appointments/slots?date=${dateStr}`);
      const data = await res.json();
      setter(data.slots || []);
    } catch {
      setter([]);
    } finally {
      loadingSetter(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    await adminFetch(`/api/clients/${clientId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(editForm),
    });
    setEditing(false);
    setSaving(false);
    await fetchData();
  }

  async function handleSaveNotes() {
    setNotesSaving(true);
    await adminFetch(`/api/clients/${clientId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ adminNotes: notes }),
    });
    setNotesDirty(false);
    setNotesSaving(false);
  }

  async function handleDeleteClient() {
    await adminFetch(`/api/clients/${clientId}`, { method: "DELETE" });
    router.push("/admin/clients");
  }

  async function handleAptActionConfirm() {
    if (!aptAction) return;
    setAptActionSaving(true);
    try {
      if (aptAction.type === "cancel") {
        await adminFetch(`/api/appointments/${aptAction.apt.id}`, { method: "DELETE" });
      } else if (aptAction.type === "delete") {
        await adminFetch(`/api/appointments/${aptAction.apt.id}?purge=true`, { method: "DELETE" });
      } else if (aptAction.type === "reschedule" && rescheduleDate && rescheduleTime) {
        await adminFetch(`/api/appointments/${aptAction.apt.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ dateTime: new Date(`${rescheduleDate}T${rescheduleTime}:00`).toISOString() }),
        });
      }
      setAptAction(null);
      setRescheduleDate(null);
      setRescheduleTime(null);
      setRescheduleSlots([]);
      await fetchData();
    } finally {
      setAptActionSaving(false);
    }
  }

  async function handleBookingSubmit() {
    if (selectedSlots.length === 0) return;
    setBookingSaving(true);
    setBookingError(null);
    try {
      const dateTimes = selectedSlots
        .sort((a, b) => a.date.localeCompare(b.date))
        .map((s) => `${s.date} ${s.time}`);
      const res = await adminFetch("/api/admin/appointments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId, dateTimes, requireConfirmation }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setBookingError(data.error || "Failed to book");
        return;
      }
      setShowBooking(false);
      setSelectedSlots([]);
      setBookingActiveDate(null);
      setBookingSlots([]);
      setRequireConfirmation(false);
      await fetchData();
    } catch {
      setBookingError("Failed to book appointments");
    } finally {
      setBookingSaving(false);
    }
  }

  if (loading) return <div className="text-muted-foreground">Loading...</div>;
  if (!client) return <div className="text-muted-foreground">Client not found</div>;

  const now = new Date();
  const statsTotal = appointments.length;
  const statsConfirmed = appointments.filter((a) => a.status === "confirmed" || a.status === "completed").length;
  const statsCancelled = appointments.filter((a) => a.status === "cancelled").length;
  const statsNoShow = appointments.filter((a) => a.status === "no_show").length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">
          {client.firstName} {client.lastName || ""}
        </h1>
        <div className="flex flex-wrap gap-2">
          {!editing && (
            <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
              <Pencil className="h-4 w-4 mr-1" /> Edit
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setShowBooking(true);
              setBookingError(null);
              setSelectedSlots([]);
              setBookingActiveDate(null);
              setBookingSlots([]);
              setBookingMonth(startOfMonth(new Date()));
            }}
          >
            <CalendarPlus className="h-4 w-4 mr-1" /> Book
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="text-red-700 border-red-300 hover:bg-red-50 dark:text-red-400 dark:border-red-700 dark:hover:bg-red-900/30"
            onClick={() => setShowDeleteClient(true)}
          >
            <Trash2 className="h-4 w-4 mr-1" /> Delete
          </Button>
        </div>
      </div>

      {/* Contact + Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Contact Info</CardTitle>
          </CardHeader>
          <CardContent>
            {editing ? (
              <div className="space-y-3">
                <div>
                  <Label>First Name</Label>
                  <Input value={editForm.firstName} onChange={(e) => setEditForm((f) => ({ ...f, firstName: e.target.value }))} />
                </div>
                <div>
                  <Label>Last Name</Label>
                  <Input value={editForm.lastName} onChange={(e) => setEditForm((f) => ({ ...f, lastName: e.target.value }))} />
                </div>
                <div>
                  <Label>Phone</Label>
                  <Input value={editForm.phone} onChange={(e) => setEditForm((f) => ({ ...f, phone: e.target.value }))} />
                </div>
                <div>
                  <Label>Email</Label>
                  <Input value={editForm.email} onChange={(e) => setEditForm((f) => ({ ...f, email: e.target.value }))} />
                </div>
                <div className="flex gap-2 pt-2">
                  <Button size="sm" onClick={handleSave} disabled={saving}>
                    <Save className="h-4 w-4 mr-1" />{saving ? "Saving..." : "Save"}
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => {
                    setEditing(false);
                    setEditForm({ firstName: client.firstName, lastName: client.lastName || "", phone: client.phone, email: client.email || "" });
                  }}>
                    <X className="h-4 w-4 mr-1" /> Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-2 text-sm">
                <div><span className="text-muted-foreground">Phone: </span>{client.phone}</div>
                {client.email && <div><span className="text-muted-foreground">Email: </span>{client.email}</div>}
                {client.telegramChatId && <div><span className="text-muted-foreground">Telegram: </span>connected</div>}
                <div>
                  <span className="text-muted-foreground">Client since: </span>
                  {client.createdAt ? formatInTimeZone(client.createdAt, timezone, "dd.MM.yyyy") : "—"}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Statistics</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-muted-foreground">Total</p>
                <p className="text-2xl font-bold">{statsTotal}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Confirmed</p>
                <p className="text-2xl font-bold text-green-600 dark:text-green-400">{statsConfirmed}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Cancelled</p>
                <p className="text-2xl font-bold text-orange-600 dark:text-orange-400">{statsCancelled}</p>
              </div>
              <div>
                <p className="text-muted-foreground">No-show</p>
                <p className="text-2xl font-bold text-red-600 dark:text-red-400">{statsNoShow}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Admin notes */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Additional Info</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <Textarea
            placeholder="Admin notes about this client..."
            value={notes}
            onChange={(e) => { setNotes(e.target.value); setNotesDirty(true); }}
            rows={3}
            className="resize-none"
          />
          {notesDirty && (
            <Button size="sm" onClick={handleSaveNotes} disabled={notesSaving}>
              <Save className="h-4 w-4 mr-1" />{notesSaving ? "Saving..." : "Save Notes"}
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Appointment history */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Appointment History</CardTitle>
        </CardHeader>
        <CardContent>
          {appointments.length === 0 ? (
            <p className="text-muted-foreground">No appointments</p>
          ) : (
            <div className="space-y-2">
              {appointments.map((apt) => {
                const isPast = new Date(apt.dateTime) < now;
                const isCancelled = apt.status === "cancelled";
                return (
                  <div
                    key={apt.id}
                    className={`flex items-center justify-between p-3 border rounded-lg gap-3 ${isCancelled ? "opacity-60" : ""}`}
                  >
                    <div className="min-w-0 flex-1">
                      <p className={`text-sm font-medium ${isPast ? "text-muted-foreground" : ""}`}>
                        {formatInTimeZone(apt.dateTime, timezone, "dd.MM.yyyy HH:mm")}
                        {isPast && <span className="ml-2 text-xs font-normal">(past)</span>}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {apt.durationMinutes} min — via {apt.source}
                      </p>
                      {apt.notes && (
                        <p className="text-xs text-muted-foreground mt-1 truncate">{apt.notes}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Badge className={statusColor[apt.status] || ""}>{apt.status}</Badge>
                      {/* Reschedule — only for active appointments */}
                      {!isCancelled && apt.status !== "completed" && apt.status !== "no_show" && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-muted-foreground hover:text-foreground"
                          title="Reschedule"
                          onClick={() => {
                            setAptAction({ type: "reschedule", apt });
                            setRescheduleMonth(startOfMonth(new Date()));
                            setRescheduleDate(null);
                            setRescheduleTime(null);
                            setRescheduleSlots([]);
                          }}
                        >
                          <Calendar className="h-3.5 w-3.5" />
                        </Button>
                      )}
                      {/* Cancel — only for non-cancelled */}
                      {!isCancelled && apt.status !== "completed" && apt.status !== "no_show" && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-orange-500 hover:text-orange-700 hover:bg-orange-50 dark:hover:bg-orange-900/30"
                          title="Cancel appointment"
                          onClick={() => setAptAction({ type: "cancel", apt })}
                        >
                          <XCircle className="h-3.5 w-3.5" />
                        </Button>
                      )}
                      {/* Delete from DB — always available */}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/30"
                        title="Delete from database"
                        onClick={() => setAptAction({ type: "delete", apt })}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Delete client dialog ─────────────────────────────────── */}
      <Dialog open={showDeleteClient} onOpenChange={setShowDeleteClient}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Delete Client</DialogTitle></DialogHeader>
          <p className="text-sm">
            Permanently delete {client.firstName} {client.lastName || ""}? This cannot be undone.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteClient(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDeleteClient}>Delete Client</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Appointment action dialogs ───────────────────────────── */}
      {/* Cancel */}
      <Dialog
        open={aptAction?.type === "cancel"}
        onOpenChange={(v) => { if (!v) setAptAction(null); }}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Cancel Appointment</DialogTitle></DialogHeader>
          <p className="text-sm">Cancel this appointment? The client will be notified via Telegram.</p>
          {aptAction && (
            <p className="text-sm text-muted-foreground">
              {formatInTimeZone(aptAction.apt.dateTime, timezone, "dd.MM.yyyy HH:mm")}
            </p>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setAptAction(null)}>Back</Button>
            <Button variant="destructive" onClick={handleAptActionConfirm} disabled={aptActionSaving}>
              {aptActionSaving ? "Cancelling..." : "Cancel Appointment"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete from DB */}
      <Dialog
        open={aptAction?.type === "delete"}
        onOpenChange={(v) => { if (!v) setAptAction(null); }}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Delete Record</DialogTitle></DialogHeader>
          <p className="text-sm">Permanently delete this appointment record from the database? This cannot be undone.</p>
          {aptAction && (
            <p className="text-sm text-muted-foreground">
              {formatInTimeZone(aptAction.apt.dateTime, timezone, "dd.MM.yyyy HH:mm")} — {aptAction.apt.status}
            </p>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setAptAction(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleAptActionConfirm} disabled={aptActionSaving}>
              {aptActionSaving ? "Deleting..." : "Delete Record"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reschedule */}
      <Dialog
        open={aptAction?.type === "reschedule"}
        onOpenChange={(v) => { if (!v) { setAptAction(null); setRescheduleDate(null); setRescheduleTime(null); setRescheduleSlots([]); } }}
      >
        <DialogContent className="max-w-sm max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Reschedule Appointment</DialogTitle></DialogHeader>
          {aptAction && (
            <p className="text-sm text-muted-foreground">
              Current: {formatInTimeZone(aptAction.apt.dateTime, timezone, "dd.MM.yyyy HH:mm")}
            </p>
          )}
          <MiniCalendar
            month={rescheduleMonth}
            onMonthChange={setRescheduleMonth}
            onDayClick={(dateStr) => {
              setRescheduleDate(dateStr);
              setRescheduleTime(null);
              fetchSlots(dateStr, setRescheduleSlots, setRescheduleLoadingSlots);
            }}
            isDayDisabled={(day) => day < new Date(new Date().setHours(0, 0, 0, 0))}
            isDayActive={(dateStr) => dateStr === rescheduleDate}
          />
          {rescheduleDate && (
            <div className="space-y-2">
              <p className="text-sm font-medium">
                {format(new Date(rescheduleDate + "T12:00:00"), "EEE, d MMMM")} — pick a time
              </p>
              {rescheduleLoadingSlots ? (
                <p className="text-sm text-muted-foreground">Loading slots…</p>
              ) : rescheduleSlots.length === 0 ? (
                <p className="text-sm text-muted-foreground">No available slots on this day.</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {rescheduleSlots.map((slot) => (
                    <button
                      key={slot}
                      onClick={() => setRescheduleTime(slot)}
                      className={`px-3 py-1.5 rounded border text-sm font-medium transition-colors ${
                        rescheduleTime === slot
                          ? "bg-primary text-primary-foreground border-primary"
                          : "hover:bg-accent border-input"
                      }`}
                    >
                      {slot}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setAptAction(null)}>Cancel</Button>
            <Button
              onClick={handleAptActionConfirm}
              disabled={aptActionSaving || !rescheduleDate || !rescheduleTime}
            >
              {aptActionSaving ? "Saving..." : "Reschedule"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Book appointment dialog ──────────────────────────────── */}
      <Dialog
        open={showBooking}
        onOpenChange={(v) => { if (!v) { setShowBooking(false); setSelectedSlots([]); setBookingActiveDate(null); setBookingSlots([]); } }}
      >
        <DialogContent className="max-w-sm max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Book for {client.firstName}</DialogTitle>
          </DialogHeader>
          <MiniCalendar
            month={bookingMonth}
            onMonthChange={setBookingMonth}
            onDayClick={(dateStr) => {
              setBookingActiveDate(dateStr);
              fetchSlots(dateStr, setBookingSlots, setBookingLoadingSlots);
            }}
            isDayDisabled={(day) => {
              const today = new Date(); today.setHours(0, 0, 0, 0);
              return day < today;
            }}
            isDayActive={(dateStr) => dateStr === bookingActiveDate}
            isDayHighlighted={(dateStr) => selectedSlots.some((s) => s.date === dateStr)}
          />

          {/* Slot chips for active date */}
          {bookingActiveDate && (
            <div className="space-y-2">
              <p className="text-sm font-medium">
                {format(new Date(bookingActiveDate + "T12:00:00"), "EEE, d MMMM")}
              </p>
              {bookingLoadingSlots ? (
                <p className="text-sm text-muted-foreground">Loading slots…</p>
              ) : bookingSlots.length === 0 ? (
                <p className="text-sm text-muted-foreground">No available slots on this day.</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {bookingSlots.map((slot) => {
                    const isChosen = selectedSlots.some((s) => s.date === bookingActiveDate && s.time === slot);
                    return (
                      <button
                        key={slot}
                        onClick={() => {
                          setSelectedSlots((prev) => {
                            const withoutDate = prev.filter((s) => s.date !== bookingActiveDate);
                            return isChosen ? withoutDate : [...withoutDate, { date: bookingActiveDate!, time: slot }];
                          });
                        }}
                        className={`px-3 py-1.5 rounded border text-sm font-medium transition-colors ${
                          isChosen
                            ? "bg-primary text-primary-foreground border-primary"
                            : "hover:bg-accent border-input"
                        }`}
                      >
                        {slot}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Selected summary */}
          {selectedSlots.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-sm font-medium">Selected ({selectedSlots.length})</p>
              {selectedSlots.sort((a, b) => a.date.localeCompare(b.date)).map((s) => (
                <div key={s.date} className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">
                    {format(new Date(s.date + "T12:00:00"), "EEE d MMM")} — {s.time}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-5 w-5 text-muted-foreground"
                    onClick={() => setSelectedSlots((prev) => prev.filter((p) => p.date !== s.date))}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>
          )}

          <div className="flex items-center gap-2">
            <Checkbox
              id="req-confirm"
              checked={requireConfirmation}
              onCheckedChange={(v) => setRequireConfirmation(!!v)}
            />
            <Label htmlFor="req-confirm" className="font-normal text-sm cursor-pointer">
              Require confirmation from client
            </Label>
          </div>

          {bookingError && <p className="text-sm text-destructive">{bookingError}</p>}

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowBooking(false)}>Cancel</Button>
            <Button
              onClick={handleBookingSubmit}
              disabled={bookingSaving || selectedSlots.length === 0}
            >
              {bookingSaving ? "Saving..." : `Book${selectedSlots.length > 0 ? ` (${selectedSlots.length})` : ""}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
