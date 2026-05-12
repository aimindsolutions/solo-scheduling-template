"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Pencil, Trash2, Save, X } from "lucide-react";
import { adminFetch } from "@/lib/api-client";
import { formatInTimeZone } from "@/lib/date-utils";

interface ClientDetail {
  id: string;
  firstName: string;
  lastName?: string;
  phone: string;
  email?: string;
  language?: string;
  telegramChatId?: string;
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

export default function ClientDetailPage() {
  const params = useParams();
  const router = useRouter();
  const clientId = params.id as string;
  const [client, setClient] = useState<ClientDetail | null>(null);
  const [appointments, setAppointments] = useState<AppointmentData[]>([]);
  const [timezone, setTimezone] = useState("Europe/Kyiv");
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    firstName: "",
    lastName: "",
    phone: "",
    email: "",
  });
  const [showDelete, setShowDelete] = useState(false);
  const [saving, setSaving] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [clientRes, aptsRes] = await Promise.all([
        adminFetch(`/api/clients/${clientId}`),
        adminFetch(`/api/appointments?clientId=${clientId}`),
      ]);
      const clientData = await clientRes.json();
      const aptsData = await aptsRes.json();
      const c = clientData.client || clientData;
      setClient(c);
      setEditForm({
        firstName: c.firstName || "",
        lastName: c.lastName || "",
        phone: c.phone || "",
        email: c.email || "",
      });
      setAppointments(aptsData.appointments || []);
      if (aptsData.timezone) setTimezone(aptsData.timezone);
    } catch {} finally {
      setLoading(false);
    }
  }, [clientId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

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

  async function handleDelete() {
    await adminFetch(`/api/clients/${clientId}`, { method: "DELETE" });
    router.push("/admin/clients");
  }

  if (loading) return <div className="text-muted-foreground">Loading...</div>;
  if (!client) return <div className="text-muted-foreground">Client not found</div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">
          {client.firstName} {client.lastName || ""}
        </h1>
        <div className="flex gap-2">
          {!editing && (
            <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
              <Pencil className="h-4 w-4 mr-1" /> Edit
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            className="text-red-700 border-red-300 hover:bg-red-50 dark:text-red-400 dark:border-red-700 dark:hover:bg-red-900/30"
            onClick={() => setShowDelete(true)}
          >
            <Trash2 className="h-4 w-4 mr-1" /> Delete
          </Button>
        </div>
      </div>

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
                  <Input
                    value={editForm.firstName}
                    onChange={(e) =>
                      setEditForm((f) => ({ ...f, firstName: e.target.value }))
                    }
                  />
                </div>
                <div>
                  <Label>Last Name</Label>
                  <Input
                    value={editForm.lastName}
                    onChange={(e) =>
                      setEditForm((f) => ({ ...f, lastName: e.target.value }))
                    }
                  />
                </div>
                <div>
                  <Label>Phone</Label>
                  <Input
                    value={editForm.phone}
                    onChange={(e) =>
                      setEditForm((f) => ({ ...f, phone: e.target.value }))
                    }
                  />
                </div>
                <div>
                  <Label>Email</Label>
                  <Input
                    value={editForm.email}
                    onChange={(e) =>
                      setEditForm((f) => ({ ...f, email: e.target.value }))
                    }
                  />
                </div>
                <div className="flex gap-2 pt-2">
                  <Button size="sm" onClick={handleSave} disabled={saving}>
                    <Save className="h-4 w-4 mr-1" />
                    {saving ? "Saving..." : "Save"}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setEditing(false);
                      setEditForm({
                        firstName: client.firstName,
                        lastName: client.lastName || "",
                        phone: client.phone,
                        email: client.email || "",
                      });
                    }}
                  >
                    <X className="h-4 w-4 mr-1" /> Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-2 text-sm">
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
                {client.telegramChatId && (
                  <div>
                    <span className="text-muted-foreground">Telegram: </span>
                    connected
                  </div>
                )}
                <div>
                  <span className="text-muted-foreground">Client since: </span>
                  {client.createdAt
                    ? formatInTimeZone(client.createdAt, timezone, "dd.MM.yyyy")
                    : "—"}
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
                <p className="text-2xl font-bold">{client.totalAppointments || 0}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Confirmed</p>
                <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                  {client.confirmedAppointments || 0}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">Cancelled</p>
                <p className="text-2xl font-bold text-orange-600 dark:text-orange-400">
                  {client.cancelledAppointments || 0}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">No-show</p>
                <p className="text-2xl font-bold text-red-600 dark:text-red-400">
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
                      {formatInTimeZone(apt.dateTime, timezone, "dd.MM.yyyy HH:mm")}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {apt.durationMinutes} min — via {apt.source}
                    </p>
                    {apt.notes && (
                      <p className="text-xs text-muted-foreground mt-1">{apt.notes}</p>
                    )}
                  </div>
                  <Badge className={statusColor[apt.status] || ""}>{apt.status}</Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={showDelete} onOpenChange={setShowDelete}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete Client</DialogTitle>
          </DialogHeader>
          <p className="text-sm">
            Permanently delete {client.firstName} {client.lastName || ""}? This cannot be undone.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDelete(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete}>
              Delete Client
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
