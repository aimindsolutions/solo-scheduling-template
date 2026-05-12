"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Search } from "lucide-react";
import { adminFetch } from "@/lib/api-client";

interface ClientData {
  id: string;
  firstName: string;
  lastName?: string;
  phone: string;
  email?: string;
  totalAppointments: number;
  confirmedAppointments: number;
  cancelledAppointments: number;
  noShowAppointments: number;
}

function getReliabilityBadge(client: ClientData) {
  const total = client.totalAppointments || 0;
  if (total < 2) return null;

  const cancelRate = (client.cancelledAppointments || 0) / total;
  const noShowRate = (client.noShowAppointments || 0) / total;

  if (noShowRate > 0.3)
    return <Badge className="bg-red-100 text-red-800">Unreliable</Badge>;
  if (cancelRate > 0.4)
    return <Badge className="bg-orange-100 text-orange-800">Often cancels</Badge>;
  return <Badge className="bg-green-100 text-green-800">Reliable</Badge>;
}

export default function AdminClientsPage() {
  const [clients, setClients] = useState<ClientData[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchClients() {
      try {
        const res = await adminFetch(`/api/clients?search=${search}`);
        const data = await res.json();
        setClients(data.clients || []);
      } catch {
        setClients([]);
      } finally {
        setLoading(false);
      }
    }
    fetchClients();
  }, [search]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Clients</h1>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search by name or phone..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Desktop table */}
      <Card className="hidden md:block">
        <CardContent className="p-0">
          {loading ? (
            <div className="p-6 text-muted-foreground">Loading...</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Visits</TableHead>
                  <TableHead>Reliability</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {clients.map((client) => (
                  <TableRow key={client.id}>
                    <TableCell>
                      <Link
                        href={`/admin/clients/${client.id}`}
                        className="font-medium hover:underline"
                      >
                        {client.firstName} {client.lastName || ""}
                      </Link>
                    </TableCell>
                    <TableCell>{client.phone}</TableCell>
                    <TableCell>{client.totalAppointments || 0}</TableCell>
                    <TableCell>{getReliabilityBadge(client)}</TableCell>
                  </TableRow>
                ))}
                {clients.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground">
                      No clients found
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Mobile card list */}
      <div className="md:hidden space-y-3">
        {loading ? (
          <div className="text-muted-foreground">Loading...</div>
        ) : clients.length === 0 ? (
          <p className="text-center text-muted-foreground">No clients found</p>
        ) : (
          clients.map((client) => (
            <Link key={client.id} href={`/admin/clients/${client.id}`}>
              <Card className="hover:bg-accent transition-colors">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">
                        {client.firstName} {client.lastName || ""}
                      </p>
                      <p className="text-sm text-muted-foreground">{client.phone}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">
                        {client.totalAppointments || 0} visits
                      </span>
                      {getReliabilityBadge(client)}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
