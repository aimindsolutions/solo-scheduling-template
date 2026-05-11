"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";

interface ClientDetail {
  id: string;
  firstName: string;
  lastName?: string;
  phone: string;
  email?: string;
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
}

const statusColor: Record<string, string> = {
  booked: "bg-orange-100 text-orange-800",
  confirmed: "bg-green-100 text-green-800",
  cancelled: "bg-red-100 text-red-800",
  completed: "bg-blue-100 text-blue-800",
  no_show: "bg-gray-100 text-gray-800",
};

export default function ClientDetailPage() {
  const params = useParams();
  const clientId = params.id as string;
  const [client, setClient] = useState<ClientDetail | null>(null);
  const [appointments, setAppointments] = useState<AppointmentData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const [clientRes, aptsRes] = await Promise.all([
          fetch(`/api/clients/${clientId}`),
          fetch(`/api/appointments?clientId=${clientId}`),
        ]);
        const clientData = await clientRes.json();
        const aptsData = await aptsRes.json();
        setClient(clientData.client || clientData);
        setAppointments(aptsData.appointments || []);
      } catch {
        // handle error
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [clientId]);

  if (loading) return <div className="text-muted-foreground">Loading...</div>;
  if (!client) return <div className="text-muted-foreground">Client not found</div>;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">
        {client.firstName} {client.lastName || ""}
      </h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Contact Info</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div>
              <span className="text-muted-foreground">Phone: </span>
              {client.phone}
            </div>
            {client.email && (
              <div>
                <span className="text-muted-foreground">Email: </span>
                {client.email}
              </div>
            )}
            <div>
              <span className="text-muted-foreground">Client since: </span>
              {client.createdAt
                ? format(new Date(client.createdAt), "dd.MM.yyyy")
                : "—"}
            </div>
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
                <p className="text-2xl font-bold">
                  {client.totalAppointments || 0}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">Confirmed</p>
                <p className="text-2xl font-bold text-green-600">
                  {client.confirmedAppointments || 0}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">Cancelled</p>
                <p className="text-2xl font-bold text-orange-600">
                  {client.cancelledAppointments || 0}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">No-show</p>
                <p className="text-2xl font-bold text-red-600">
                  {client.noShowAppointments || 0}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Appointment History</CardTitle>
        </CardHeader>
        <CardContent>
          {appointments.length === 0 ? (
            <p className="text-muted-foreground">No appointments</p>
          ) : (
            <div className="space-y-2">
              {appointments.map((apt) => (
                <div
                  key={apt.id}
                  className="flex items-center justify-between p-3 border rounded-lg"
                >
                  <div>
                    <p className="text-sm font-medium">
                      {format(new Date(apt.dateTime), "dd.MM.yyyy HH:mm")}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {apt.durationMinutes} min — via {apt.source}
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
