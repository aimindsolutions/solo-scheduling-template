"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { format, startOfWeek, addDays, isSameDay } from "date-fns";

interface AppointmentData {
  id: string;
  clientName: string;
  dateTime: string;
  durationMinutes: number;
  status: string;
}

export default function AdminCalendarPage() {
  const [appointments, setAppointments] = useState<AppointmentData[]>([]);
  const [weekStart, setWeekStart] = useState(() =>
    startOfWeek(new Date(), { weekStartsOn: 1 })
  );
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

  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  const statusColor: Record<string, string> = {
    booked: "bg-orange-500",
    confirmed: "bg-green-500",
    cancelled: "bg-red-300",
    completed: "bg-blue-500",
    no_show: "bg-gray-400",
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Calendar</h1>
        <div className="flex items-center gap-2">
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
        <div className="grid grid-cols-7 gap-2">
          {days.map((day) => {
            const dayAppointments = appointments.filter(
              (a) =>
                isSameDay(new Date(a.dateTime), day) &&
                a.status !== "cancelled"
            );
            const isToday = isSameDay(day, new Date());

            return (
              <Card
                key={day.toISOString()}
                className={isToday ? "border-primary" : ""}
              >
                <CardHeader className="p-3 pb-1">
                  <CardTitle
                    className={`text-sm ${isToday ? "text-primary" : "text-muted-foreground"}`}
                  >
                    {format(day, "EEE d")}
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-3 pt-1 space-y-1 min-h-[120px]">
                  {dayAppointments.map((apt) => (
                    <div
                      key={apt.id}
                      className="text-xs p-1.5 rounded border flex items-center gap-1.5"
                    >
                      <div
                        className={`w-2 h-2 rounded-full ${statusColor[apt.status] || ""}`}
                      />
                      <span className="font-medium">
                        {format(new Date(apt.dateTime), "HH:mm")}
                      </span>
                      <span className="truncate text-muted-foreground">
                        {apt.clientName}
                      </span>
                    </div>
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
    </div>
  );
}
