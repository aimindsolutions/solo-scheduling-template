"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { ChevronLeft, ChevronRight, Eye, Trash2, CheckCircle, EyeOff } from "lucide-react";
import { adminFetch } from "@/lib/api-client";
import { format, startOfWeek, addDays, isSameDay } from "date-fns";
import { formatInTimeZone } from "@/lib/date-utils";

interface AppointmentData {
  id: string;
  clientName: string;
  clientPhone: string;
  dateTime: string;
  durationMinutes: number;
  status: string;
  source: string;
  notes?: string;
  googleCalendarEventId?: string;
  createdAt?: string;
}

const statusColor: Record<string, string> = {
  booked: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300",
  confirmed: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  cancelled: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
  completed: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  no_show: "bg-gray-100 text-gray-800 dark:bg-gray-800/30 dark:text-gray-300",
};

const statusDot: Record<string, string> = {
  booked: "bg-orange-500",
  confirmed: "bg-green-500",
  cancelled: "bg-red-500",
  completed: "bg-blue-500",
  no_show: "bg-gray-400",
};

export default function AdminCalendarPage() {
  const [appointments, setAppointments] = useState<AppointmentData[]>([]);
  const [timezone, setTimezone] = useState("Europe/Kyiv");
  const [weekStart, setWeekStart] = useState(() =>
    startOfWeek(new Date(), { weekStartsOn: 1 })
  );
  const [loading, setLoading] = useState(true);
  const [showCancelled, setShowCancelled] = useState(false);
  const [selectedApt, setSelectedApt] = useState<AppointmentData | null>(null);
  const [dayView, setDayView] = useState<Date | null>(null);
  const [confirmAction, setConfirmAction] = useState<{
    type: "cancel" | "confirm" | "no_show" | "complete";
    apt: AppointmentData;
  } | null>(null);

  const fetchAppointments = useCallback(async () => {
    try {
      const all: AppointmentData[] = [];
      let cursor: string | null = null;
      do {
        const url = cursor ? `/api/appointments?cursor=${cursor}` : "/api/appointments";
        const res = await adminFetch(url);
        const data = await res.json();
        all.push(...(data.appointments || []));
        if (data.timezone) setTimezone(data.timezone);
        cursor = data.nextCursor ?? null;
      } while (cursor);
      setAppointments(all);
    } catch {
      setAppointments([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAppointments();
  }, [fetchAppointments]);

  function fmtTime(iso: string) {
    return formatInTimeZone(iso, timezone, "HH:mm");
  }
  function fmtDateTime(iso: string) {
    return formatInTimeZone(iso, timezone, "dd.MM.yyyy HH:mm");
  }
  function fmtShort(iso: string) {
    return formatInTimeZone(iso, timezone, "dd.MM HH:mm");
  }
  function getAptDateStr(iso: string) {
    return formatInTimeZone(iso, timezone, "yyyy-MM-dd");
  }

  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  async function handleStatusChange(aptId: string, newStatus: string) {
    await adminFetch(`/api/appointments/${aptId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    });
    setConfirmAction(null);
    setSelectedApt(null);
    await fetchAppointments();
  }

  async function handleDelete(aptId: string) {
    await adminFetch(`/api/appointments/${aptId}`, { method: "DELETE" });
    setConfirmAction(null);
    setSelectedApt(null);
    await fetchAppointments();
  }

  function AppointmentDetailDialog() {
    if (!selectedApt) return null;
    const apt = selectedApt;
    return (
      <Dialog open={!!selectedApt} onOpenChange={() => setSelectedApt(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{apt.clientName}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Status</span>
              <Badge className={statusColor[apt.status]}>{apt.status}</Badge>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Date & Time</span>
              <span>{fmtDateTime(apt.dateTime)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Duration</span>
              <span>{apt.durationMinutes} min</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Phone</span>
              <span>{apt.clientPhone || "—"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Source</span>
              <span>{apt.source}</span>
            </div>
            {apt.notes && (
              <div>
                <span className="text-muted-foreground">Notes:</span>
                <p className="mt-1 p-2 bg-muted rounded text-sm">{apt.notes}</p>
              </div>
            )}
            {apt.createdAt && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Created</span>
                <span>{fmtDateTime(apt.createdAt)}</span>
              </div>
            )}
          </div>
          {apt.status !== "cancelled" && (
            <DialogFooter className="flex-col gap-2 sm:flex-row">
              {apt.status === "booked" && (
                <Button
                  size="sm"
                  className="bg-green-600 hover:bg-green-700"
                  onClick={() => setConfirmAction({ type: "confirm", apt })}
                >
                  <CheckCircle className="h-4 w-4 mr-1" /> Confirm
                </Button>
              )}
              {(apt.status === "booked" || apt.status === "confirmed") && (
                <>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setConfirmAction({ type: "complete", apt })}
                  >
                    Complete
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setConfirmAction({ type: "no_show", apt })}
                  >
                    No Show
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => setConfirmAction({ type: "cancel", apt })}
                  >
                    <Trash2 className="h-4 w-4 mr-1" /> Cancel
                  </Button>
                </>
              )}
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>
    );
  }

  function ConfirmActionDialog() {
    if (!confirmAction) return null;
    const labels: Record<string, string> = {
      cancel: "Cancel this appointment? The client will be notified.",
      confirm: "Confirm this appointment?",
      no_show: "Mark as no-show?",
      complete: "Mark as completed?",
    };
    return (
      <Dialog open={!!confirmAction} onOpenChange={() => setConfirmAction(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Confirm Action</DialogTitle>
          </DialogHeader>
          <p className="text-sm">{labels[confirmAction.type]}</p>
          <p className="text-sm text-muted-foreground">
            {confirmAction.apt.clientName} — {fmtShort(confirmAction.apt.dateTime)}
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmAction(null)}>
              Back
            </Button>
            {confirmAction.type === "cancel" ? (
              <Button
                variant="destructive"
                onClick={() => handleDelete(confirmAction.apt.id)}
              >
                Cancel Appointment
              </Button>
            ) : (
              <Button
                onClick={() =>
                  handleStatusChange(
                    confirmAction.apt.id,
                    confirmAction.type === "confirm"
                      ? "confirmed"
                      : confirmAction.type === "complete"
                        ? "completed"
                        : "no_show"
                  )
                }
              >
                Confirm
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  function DayViewDialog() {
    if (!dayView) return null;
    const dayStr = format(dayView, "yyyy-MM-dd");
    const dayApts = appointments
      .filter((a) => getAptDateStr(a.dateTime) === dayStr && (showCancelled || a.status !== "cancelled"))
      .sort((a, b) => a.dateTime.localeCompare(b.dateTime));

    return (
      <Dialog open={!!dayView} onOpenChange={() => setDayView(null)}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{format(dayView, "EEEE, d MMMM yyyy")}</DialogTitle>
          </DialogHeader>
          {dayApts.length === 0 ? (
            <p className="text-muted-foreground text-sm">No appointments</p>
          ) : (
            <div className="space-y-3">
              {dayApts.map((apt) => (
                <div
                  key={apt.id}
                  className={`p-3 border rounded-lg space-y-2 ${apt.status === "cancelled" ? "opacity-60 border-red-200 dark:border-red-900/50" : ""}`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className={`w-2.5 h-2.5 rounded-full ${statusDot[apt.status]}`} />
                      <span className={`font-medium ${apt.status === "cancelled" ? "line-through" : ""}`}>
                        {fmtTime(apt.dateTime)}
                      </span>
                      <span>—</span>
                      <span className={`font-medium ${apt.status === "cancelled" ? "line-through" : ""}`}>{apt.clientName}</span>
                    </div>
                    <Badge className={statusColor[apt.status]}>{apt.status}</Badge>
                  </div>
                  <div className="text-sm text-muted-foreground grid grid-cols-2 gap-1">
                    <span>Phone: {apt.clientPhone || "—"}</span>
                    <span>Duration: {apt.durationMinutes} min</span>
                    <span>Source: {apt.source}</span>
                  </div>
                  {apt.notes && (
                    <p className="text-sm p-2 bg-muted rounded">{apt.notes}</p>
                  )}
                  {apt.status !== "cancelled" && (
                    <div className="flex gap-2 pt-1">
                      {apt.status === "booked" && (
                        <Button
                          size="sm"
                          className="h-7 text-xs bg-green-600 hover:bg-green-700"
                          onClick={() => setConfirmAction({ type: "confirm", apt })}
                        >
                          Confirm
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="destructive"
                        className="h-7 text-xs"
                        onClick={() => {
                          setDayView(null);
                          setConfirmAction({ type: "cancel", apt });
                        }}
                      >
                        Cancel
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Calendar</h1>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowCancelled((v) => !v)}
            className="gap-2"
          >
            {showCancelled ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            {showCancelled ? "Hide cancelled" : "Show cancelled"}
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={() => setWeekStart((d) => addDays(d, -7))}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm font-medium min-w-[200px] text-center">
            {format(weekStart, "d MMM")} —{" "}
            {format(addDays(weekStart, 6), "d MMM yyyy")}
          </span>
          <Button
            variant="outline"
            size="icon"
            onClick={() => setWeekStart((d) => addDays(d, 7))}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="text-muted-foreground">Loading...</div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2">
          {days.map((day) => {
            const dayStr = format(day, "yyyy-MM-dd");
            const dayAppointments = appointments
              .filter((a) => getAptDateStr(a.dateTime) === dayStr && (showCancelled || a.status !== "cancelled"))
              .sort((a, b) => a.dateTime.localeCompare(b.dateTime));
            const isToday = isSameDay(day, new Date());

            return (
              <Card
                key={day.toISOString()}
                className={isToday ? "border-primary" : ""}
              >
                <CardHeader className="p-3 pb-1">
                  <div className="flex items-center justify-between">
                    <CardTitle
                      className={`text-sm ${isToday ? "text-primary" : "text-muted-foreground"}`}
                    >
                      {format(day, "EEE d")}
                    </CardTitle>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={() => setDayView(day)}
                    >
                      <Eye className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="p-3 pt-1 space-y-1 min-h-[120px]">
                  {dayAppointments.map((apt) => (
                    <button
                      key={apt.id}
                      onClick={() => setSelectedApt(apt)}
                      className={`w-full text-left text-sm p-1.5 rounded border flex items-center gap-1.5 hover:bg-accent transition-colors cursor-pointer ${apt.status === "cancelled" ? "opacity-50" : ""}`}
                    >
                      <div
                        className={`w-2 h-2 rounded-full shrink-0 ${statusDot[apt.status] || ""}`}
                      />
                      <span className={`font-medium ${apt.status === "cancelled" ? "line-through" : ""}`}>
                        {fmtTime(apt.dateTime)}
                      </span>
                      <span className={`truncate text-muted-foreground ${apt.status === "cancelled" ? "line-through" : ""}`}>
                        {apt.clientName}
                      </span>
                    </button>
                  ))}
                  {dayAppointments.length === 0 && (
                    <p className="text-xs text-muted-foreground">—</p>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <AppointmentDetailDialog />
      <DayViewDialog />
      <ConfirmActionDialog />
    </div>
  );
}
