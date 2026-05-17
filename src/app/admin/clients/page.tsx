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
import { useAdminLang } from "@/lib/admin-i18n";

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
  phoneVerified?: boolean;
  authMethods?: string[];
}

export default function AdminClientsPage() {
  const { t } = useAdminLang();
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

  function getVerificationBadge(client: ClientData) {
    const hasAuth = client.authMethods && client.authMethods.length > 0;
    if (hasAuth && client.phoneVerified) return null;
    if (hasAuth && !client.phoneVerified)
      return <Badge variant="outline" className="border-orange-400 text-orange-600 text-xs">{t.badge_unverified}</Badge>;
    return null;
  }

  function getReliabilityBadge(client: ClientData) {
    const total = client.totalAppointments || 0;
    if (total < 2) return null;
    const cancelRate = (client.cancelledAppointments || 0) / total;
    const noShowRate = (client.noShowAppointments || 0) / total;
    if (noShowRate > 0.3)
      return <Badge className="bg-red-100 text-red-800">{t.badge_unreliable}</Badge>;
    if (cancelRate > 0.4)
      return <Badge className="bg-orange-100 text-orange-800">{t.badge_oftenCancels}</Badge>;
    return <Badge className="bg-green-100 text-green-800">{t.badge_reliable}</Badge>;
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{t.clients}</h1>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder={t.searchPlaceholder}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Desktop table */}
      <Card className="hidden md:block">
        <CardContent className="p-0">
          {loading ? (
            <div className="p-6 text-muted-foreground">{t.loading}</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t.col_name}</TableHead>
                  <TableHead>{t.col_phone}</TableHead>
                  <TableHead>{t.col_visits}</TableHead>
                  <TableHead>{t.col_reliability}</TableHead>
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
                    <TableCell>
                      <div className="flex gap-1 flex-wrap">
                        {getVerificationBadge(client)}
                        {getReliabilityBadge(client)}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {clients.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground">
                      {t.noClientsFound}
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
          <div className="text-muted-foreground">{t.loading}</div>
        ) : clients.length === 0 ? (
          <p className="text-center text-muted-foreground">{t.noClientsFound}</p>
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
                    <div className="flex items-center gap-2 flex-wrap justify-end">
                      <span className="text-sm text-muted-foreground">
                        {t.visitsLabel(client.totalAppointments || 0)}
                      </span>
                      {getVerificationBadge(client)}
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
