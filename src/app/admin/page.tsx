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
import { format } from "date-fns";
import { CheckCircle, X } from "lucide-react";

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
  booked: "bg-orange-100 text-orange-800",
  confirmed: "bg-green-100 text-green-800",
  cancelled: "bg-red-100 text-red-800",
  completed: "bg-blue-100 text-blue-800",
  no_show: "bg-gray-100 text-gray-800",
};

export default function AdminDashboardPage() {
  const [appointments, setAppointments] = useState<AppointmentData[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirmAction, setConfirmAction] = useState<{
    type: "cancel" | "confirm";
    apt: AppointmentData;
  } | null>(null);

  const fetchAppointments = useCallback(async () => {
    try {
      const res = await fetch("/api/appointments");
      const data = await res.json();
      setAppointments(data.appointments || []);
    } catch {
      setAppointments([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAppointments();
  }, [fetchAppointments]);

  const today = format(new Date(), "yyyy-MM-dd");
  const todayAppointments = appointments.filter(
    (a) => a.dateTime.startsWith(today) && a.status !== "cancelled"
  );
  const upcomingAppointments = appointments.filter(
    (a) => a.dateTime > new Date().toISOString() && a.status !== "cancelled"
  );
  const confirmedToday = todayAppointments.filter(
    (a) => a.status === "confirmed"
  ).length;
  const pendingToday = todayAppointments.filter(
    (a) => a.status === "booked"
  ).length;

  async function handleAction() {
    if (!confirmAction) return;
    if (confirmAction.type === "cancel") {
      await fetch(`/api/appointments/${confirmAction.apt.id}`, { method: "DELETE" });
    } else {
      await fetch(`/api/appointments/${confirmAction.apt.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "confirmed" }),
      });
    }
    setConfirmAction(null);
    await fetchAppointments();
  }

  if (loading) {
    return <div className="text-muted-foreground">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Dashboard</h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Today</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{todayAppointments.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Confirmed</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-600">{confirmedToday}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Pending</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-orange-600">{pendingToday}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Today&apos;s Appointments</CardTitle>
        </CardHeader>
        <CardContent>
          {todayAppointments.length === 0 ? (
            <p className="text-muted-foreground">No appointments today</p>
          ) : (
            <div className="space-y-3">
              {todayAppointments.map((apt) => (
                <div
                  key={apt.id}
                  className="flex items-center justify-between p-3 border rounded-lg"
                >
                  <div>
                    <p className="font-medium">{apt.clientName}</p>
                    <p className="text-sm text-muted-foreground">
                      {format(new Date(apt.dateTime), "HH:mm")} — {apt.clientPhone}
                    </p>
                    {apt.notes && (
                      <p className="text-xs text-muted-foreground mt-1">{apt.notes}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {apt.status === "booked" && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 text-green-700 border-green-300 hover:bg-green-50"
                        onClick={() => setConfirmAction({ type: "confirm", apt })}
                      >
                        <CheckCircle className="h-3.5 w-3.5 mr-1" /> Confirm
                      </Button>
                    )}
                    {(apt.status === "booked" || apt.status === "confirmed") && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 text-red-700 border-red-300 hover:bg-red-50"
                        onClick={() => setConfirmAction({ type: "cancel", apt })}
                      >
                        <X className="h-3.5 w-3.5 mr-1" /> Cancel
                      </Button>
                    )}
                    <Badge className={statusColor[apt.status] || ""}>{apt.status}</Badge>
                  </div>
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
          {upcomingAppointments.length === 0 ? (
            <p className="text-muted-foreground">No upcoming appointments</p>
          ) : (
            <div className="space-y-3">
              {upcomingAppointments.slice(0, 10).map((apt) => (
                <div
                  key={apt.id}
                  className="flex items-center justify-between p-3 border rounded-lg"
                >
                  <div>
                    <p className="font-medium">{apt.clientName}</p>
                    <p className="text-sm text-muted-foreground">
                      {format(new Date(apt.dateTime), "dd.MM.yyyy HH:mm")} — {apt.clientPhone}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {(apt.status === "booked" || apt.status === "confirmed") && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 text-red-700 border-red-300 hover:bg-red-50"
                        onClick={() => setConfirmAction({ type: "cancel", apt })}
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    )}
                    <Badge className={statusColor[apt.status] || ""}>{apt.status}</Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {confirmAction && (
        <Dialog open={!!confirmAction} onOpenChange={() => setConfirmAction(null)}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>
                {confirmAction.type === "cancel" ? "Cancel Appointment" : "Confirm Appointment"}
              </DialogTitle>
            </DialogHeader>
            <p className="text-sm">
              {confirmAction.type === "cancel"
                ? "Cancel this appointment? The client will be notified."
                : "Confirm this appointment?"}
            </p>
            <p className="text-sm text-muted-foreground">
              {confirmAction.apt.clientName} — {format(new Date(confirmAction.apt.dateTime), "dd.MM HH:mm")}
            </p>
            <DialogFooter>
              <Button variant="outline" onClick={() => setConfirmAction(null)}>
                Back
              </Button>
              <Button
                variant={confirmAction.type === "cancel" ? "destructive" : "default"}
                onClick={handleAction}
              >
                {confirmAction.type === "cancel" ? "Cancel Appointment" : "Confirm"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
