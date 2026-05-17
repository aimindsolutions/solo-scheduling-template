"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { CheckCircle, EyeOff, Eye } from "lucide-react";
import { adminFetch } from "@/lib/api-client";
import { formatInTimeZone } from "@/lib/date-utils";
import { startOfMonth, startOfWeek, endOfWeek, startOfDay, endOfDay } from "date-fns";

interface AppointmentData {
  id: string;
  clientName: string;
  clientPhone: string;
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

const DEFAULT_CARDS = ["today_all", "today_confirmed", "today_booked", "upcoming_all"];

const CARD_CANONICAL_ORDER = [
  "today_all", "today_confirmed", "today_booked", "today_cancelled",
  "week_all", "week_confirmed", "week_booked",
  "month_all", "month_confirmed", "month_booked",
  "upcoming_all", "upcoming_confirmed", "upcoming_booked",
];

function cardLabel(key: string): string {
  const labels: Record<string, string> = {
    today_all:        "Today",
    today_confirmed:  "Today confirmed",
    today_booked:     "Today pending",
    today_cancelled:  "Today cancelled",
    week_all:         "This week",
    week_confirmed:   "Week confirmed",
    week_booked:      "Week pending",
    month_all:        "This month",
    month_confirmed:  "Month confirmed",
    month_booked:     "Month pending",
    upcoming_all:     "Upcoming",
    upcoming_confirmed: "Upcoming confirmed",
    upcoming_booked:  "Upcoming pending",
  };
  return labels[key] ?? key;
}

function cardColor(key: string): string {
  if (key.includes("confirmed")) return "text-green-600 dark:text-green-400";
  if (key.includes("booked"))    return "text-orange-600 dark:text-orange-400";
  if (key.includes("cancelled")) return "text-red-600 dark:text-red-400";
  return "";
}

export default function AdminDashboardPage() {
  const [appointments, setAppointments] = useState<AppointmentData[]>([]);
  const [timezone, setTimezone] = useState("Europe/Kyiv");
  const [dashboardCards, setDashboardCards] = useState<string[]>(DEFAULT_CARDS);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [showCancelled, setShowCancelled] = useState(false);
  const [selectedApt, setSelectedApt] = useState<AppointmentData | null>(null);
  const [confirmAction, setConfirmAction] = useState<{
    type: "confirm" | "complete" | "no_show";
    apt: AppointmentData;
  } | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const [configRes, aptsRes] = await Promise.all([
        adminFetch("/api/config"),
        adminFetch(`/api/appointments?from=${startOfMonth(new Date()).toISOString()}&limit=500`),
      ]);
      const configData = await configRes.json();
      if (configData.config?.dashboardCards) setDashboardCards(configData.config.dashboardCards);
      const aptsData = await aptsRes.json();
      setAppointments(aptsData.appointments || []);
      setNextCursor(aptsData.nextCursor ?? null);
      if (aptsData.timezone) setTimezone(aptsData.timezone);
    } catch {
      setAppointments([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadMore = useCallback(async () => {
    if (!nextCursor) return;
    setLoadingMore(true);
    try {
      const res = await adminFetch(`/api/appointments?cursor=${nextCursor}`);
      const data = await res.json();
      setAppointments((prev) => [...prev, ...(data.appointments || [])]);
      setNextCursor(data.nextCursor ?? null);
    } catch {
      // keep existing data
    } finally {
      setLoadingMore(false);
    }
  }, [nextCursor]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  function fmtTime(iso: string) {
    return formatInTimeZone(iso, timezone, "HH:mm");
  }
  function fmtDateTime(iso: string) {
    return formatInTimeZone(iso, timezone, "dd.MM.yyyy HH:mm");
  }
  function fmtShort(iso: string) {
    return formatInTimeZone(iso, timezone, "dd.MM HH:mm");
  }

  const now = new Date();
  const nowIso = now.toISOString();
  const todayStart = startOfDay(now).toISOString();
  const todayEnd = endOfDay(now).toISOString();
  const weekStart = startOfWeek(now, { weekStartsOn: 1 }).toISOString();
  const weekEnd = endOfWeek(now, { weekStartsOn: 1 }).toISOString();
  const monthStartIso = startOfMonth(now).toISOString();
  const monthEndIso = endOfDay(new Date(now.getFullYear(), now.getMonth() + 1, 0)).toISOString();

  const inRange = (iso: string, from: string, to: string) => iso >= from && iso <= to;

  const statValues: Record<string, number> = {
    today_all:        appointments.filter((a) => inRange(a.dateTime, todayStart, todayEnd)).length,
    today_confirmed:  appointments.filter((a) => inRange(a.dateTime, todayStart, todayEnd) && a.status === "confirmed").length,
    today_booked:     appointments.filter((a) => inRange(a.dateTime, todayStart, todayEnd) && a.status === "booked").length,
    today_cancelled:  appointments.filter((a) => inRange(a.dateTime, todayStart, todayEnd) && a.status === "cancelled").length,
    week_all:         appointments.filter((a) => inRange(a.dateTime, weekStart, weekEnd)).length,
    week_confirmed:   appointments.filter((a) => inRange(a.dateTime, weekStart, weekEnd) && a.status === "confirmed").length,
    week_booked:      appointments.filter((a) => inRange(a.dateTime, weekStart, weekEnd) && a.status === "booked").length,
    month_all:        appointments.filter((a) => inRange(a.dateTime, monthStartIso, monthEndIso)).length,
    month_confirmed:  appointments.filter((a) => inRange(a.dateTime, monthStartIso, monthEndIso) && a.status === "confirmed").length,
    month_booked:     appointments.filter((a) => inRange(a.dateTime, monthStartIso, monthEndIso) && a.status === "booked").length,
    upcoming_all:     appointments.filter((a) => a.dateTime > nowIso && a.status !== "cancelled").length,
    upcoming_confirmed: appointments.filter((a) => a.dateTime > nowIso && a.status === "confirmed").length,
    upcoming_booked:  appointments.filter((a) => a.dateTime > nowIso && a.status === "booked").length,
  };

  const todayStr = formatInTimeZone(now, timezone, "yyyy-MM-dd");
  const todayAppointments = appointments.filter(
    (a) => formatInTimeZone(a.dateTime, timezone, "yyyy-MM-dd") === todayStr && a.status !== "cancelled"
  );
  const todayCancelled = appointments.filter(
    (a) => formatInTimeZone(a.dateTime, timezone, "yyyy-MM-dd") === todayStr && a.status === "cancelled"
  );
  const upcomingAppointments = appointments.filter(
    (a) => a.dateTime > nowIso && a.status !== "cancelled"
  );

  async function handleAction() {
    if (!confirmAction) return;
    const statusMap = { confirm: "confirmed", complete: "completed", no_show: "no_show" };
    await adminFetch(`/api/appointments/${confirmAction.apt.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: statusMap[confirmAction.type] }),
    });
    setConfirmAction(null);
    setSelectedApt(null);
    await fetchData();
  }

  if (loading) {
    return <div className="text-muted-foreground">Loading...</div>;
  }

  const sortedCards = [...dashboardCards].sort(
    (a, b) => CARD_CANONICAL_ORDER.indexOf(a) - CARD_CANONICAL_ORDER.indexOf(b)
  );

  const gridCols =
    sortedCards.length <= 2 ? "grid-cols-2" :
    sortedCards.length === 3 ? "grid-cols-2 md:grid-cols-3" :
    "grid-cols-2 md:grid-cols-4";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowCancelled((v) => !v)}
          className="gap-2"
        >
          {showCancelled ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          {showCancelled ? "Hide cancelled" : "Show cancelled"}
        </Button>
      </div>

      <div className={`grid ${gridCols} gap-4`}>
        {sortedCards.map((key) => (
          <Card key={key}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">{cardLabel(key)}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className={`text-3xl font-bold ${cardColor(key)}`}>{statValues[key] ?? 0}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Today&apos;s Appointments</CardTitle>
        </CardHeader>
        <CardContent>
          {todayAppointments.length === 0 && todayCancelled.length === 0 ? (
            <p className="text-muted-foreground">No appointments today</p>
          ) : (
            <div className="space-y-3">
              {todayAppointments.map((apt) => (
                <div
                  key={apt.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 border rounded-lg hover:bg-accent/50 cursor-pointer transition-colors"
                  onClick={() => setSelectedApt(apt)}
                >
                  <div>
                    <p className="font-medium">{apt.clientName}</p>
                    <p className="text-sm text-muted-foreground">
                      {fmtTime(apt.dateTime)} — {apt.clientPhone}
                    </p>
                    {apt.notes && (
                      <p className="text-xs text-muted-foreground mt-1">💬 {apt.notes}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                    {apt.status === "booked" && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 text-green-700 border-green-300 hover:bg-green-50 dark:text-green-400 dark:border-green-700 dark:hover:bg-green-900/30"
                        onClick={() => setConfirmAction({ type: "confirm", apt })}
                      >
                        <CheckCircle className="h-3.5 w-3.5 mr-1" /> Confirm
                      </Button>
                    )}
                    <Badge className={statusColor[apt.status] || ""}>{apt.status}</Badge>
                  </div>
                </div>
              ))}
              {showCancelled && todayCancelled.map((apt) => (
                <div
                  key={apt.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 border border-red-200 dark:border-red-900/50 rounded-lg opacity-60 cursor-pointer"
                  onClick={() => setSelectedApt(apt)}
                >
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full bg-red-500 shrink-0" />
                    <div>
                      <p className="font-medium line-through">{apt.clientName}</p>
                      <p className="text-sm text-muted-foreground">
                        {fmtTime(apt.dateTime)} — {apt.clientPhone}
                      </p>
                    </div>
                  </div>
                  <Badge className={statusColor.cancelled}>cancelled</Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Upcoming</CardTitle>
        </CardHeader>
        <CardContent>
          {(() => {
            const nowIso2 = new Date().toISOString();
            const upcomingCancelled = showCancelled
              ? appointments.filter((a) => a.dateTime > nowIso2 && a.status === "cancelled")
              : [];
            const list = [...upcomingAppointments, ...upcomingCancelled]
              .sort((a, b) => a.dateTime.localeCompare(b.dateTime))
              .slice(0, 10);
            if (list.length === 0) return <p className="text-muted-foreground">No upcoming appointments</p>;
            return (
              <div className="space-y-3">
                {list.map((apt) => (
                  <div
                    key={apt.id}
                    className={`flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 border rounded-lg cursor-pointer transition-colors ${apt.status === "cancelled" ? "opacity-60 border-red-200 dark:border-red-900/50" : "hover:bg-accent/50"}`}
                    onClick={() => setSelectedApt(apt)}
                  >
                    <div>
                      <p className={`font-medium ${apt.status === "cancelled" ? "line-through" : ""}`}>{apt.clientName}</p>
                      <p className="text-sm text-muted-foreground">
                        {fmtDateTime(apt.dateTime)} — {apt.clientPhone}
                      </p>
                      {apt.notes && (
                        <p className="text-xs text-muted-foreground mt-1">💬 {apt.notes}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge className={statusColor[apt.status] || ""}>{apt.status}</Badge>
                    </div>
                  </div>
                ))}
              </div>
            );
          })()}
        </CardContent>
      </Card>

      {selectedApt && (
        <Dialog open={!!selectedApt} onOpenChange={() => setSelectedApt(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>{selectedApt.clientName}</DialogTitle>
            </DialogHeader>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Status</span>
                <Badge className={statusColor[selectedApt.status]}>{selectedApt.status}</Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Date & Time</span>
                <span>{fmtDateTime(selectedApt.dateTime)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Duration</span>
                <span>{selectedApt.durationMinutes} min</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Phone</span>
                <span>{selectedApt.clientPhone || "—"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Source</span>
                <span>{selectedApt.source}</span>
              </div>
              {selectedApt.notes && (
                <div>
                  <span className="text-muted-foreground">Notes:</span>
                  <p className="mt-1 p-2 bg-muted rounded text-sm">{selectedApt.notes}</p>
                </div>
              )}
            </div>
            {selectedApt.status !== "cancelled" && (
              <DialogFooter className="flex-col gap-2 sm:flex-row">
                {selectedApt.status === "booked" && (
                  <Button
                    size="sm"
                    className="bg-green-600 hover:bg-green-700"
                    onClick={() => setConfirmAction({ type: "confirm", apt: selectedApt })}
                  >
                    <CheckCircle className="h-4 w-4 mr-1" /> Confirm
                  </Button>
                )}
                {(selectedApt.status === "booked" || selectedApt.status === "confirmed") && (
                  <>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setConfirmAction({ type: "complete", apt: selectedApt })}
                    >
                      Complete
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setConfirmAction({ type: "no_show", apt: selectedApt })}
                    >
                      No Show
                    </Button>
                  </>
                )}
              </DialogFooter>
            )}
          </DialogContent>
        </Dialog>
      )}

      {nextCursor && (
        <div className="flex justify-center">
          <Button variant="outline" onClick={loadMore} disabled={loadingMore}>
            {loadingMore ? "Loading…" : "Load more appointments"}
          </Button>
        </div>
      )}

      {confirmAction && (
        <Dialog open={!!confirmAction} onOpenChange={() => setConfirmAction(null)}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>Confirm Action</DialogTitle>
            </DialogHeader>
            <p className="text-sm">
              {confirmAction.type === "confirm"
                ? "Confirm this appointment?"
                : confirmAction.type === "complete"
                  ? "Mark as completed?"
                  : "Mark as no-show?"}
            </p>
            <p className="text-sm text-muted-foreground">
              {confirmAction.apt.clientName} — {fmtShort(confirmAction.apt.dateTime)}
            </p>
            <DialogFooter>
              <Button variant="outline" onClick={() => setConfirmAction(null)}>
                Back
              </Button>
              <Button onClick={handleAction}>
                Confirm
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
