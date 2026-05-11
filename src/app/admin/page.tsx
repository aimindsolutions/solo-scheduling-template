"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";

interface AppointmentData {
  id: string;
  clientName: string;
  clientPhone: string;
  dateTime: string;
  durationMinutes: number;
  status: string;
  source: string;
}

export default function AdminDashboardPage() {
  const [appointments, setAppointments] = useState<AppointmentData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchAppointments() {
      try {
        const res = await fetch("/api/appointments");
        const data = await res.json();
        setAppointments(data.appointments || []);
      } catch {
        setAppointments([]);
      } finally {
        setLoading(false);
      }
    }
    fetchAppointments();
  }, []);

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

  const statusColor: Record<string, string> = {
    booked: "bg-orange-100 text-orange-800",
    confirmed: "bg-green-100 text-green-800",
    cancelled: "bg-red-100 text-red-800",
    completed: "bg-blue-100 text-blue-800",
    no_show: "bg-gray-100 text-gray-800",
  };

  if (loading) {
    return <div className="text-muted-foreground">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Dashboard</h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">
              Today
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{todayAppointments.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">
              Confirmed
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-600">
              {confirmedToday}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">
              Pending
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-orange-600">
              {pendingToday}
            </div>
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
                  </div>
                  <Badge className={statusColor[apt.status] || ""}>
                    {apt.status}
                  </Badge>
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
                      {format(new Date(apt.dateTime), "dd.MM.yyyy HH:mm")} —{" "}
                      {apt.clientPhone}
                    </p>
                  </div>
                  <Badge className={statusColor[apt.status] || ""}>
                    {apt.status}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
