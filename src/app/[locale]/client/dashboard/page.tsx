"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatInTimeZone } from "@/lib/date-utils";
import type { AppointmentStatus } from "@/types";
import { LanguageSwitcher } from "@/components/shared/language-switcher";
import { QRCodeSVG } from "qrcode.react";

interface AppointmentRow {
  id: string;
  dateTime: string;
  status: AppointmentStatus;
  clientName: string;
}

interface DashboardData {
  appointments: AppointmentRow[];
  timezone: string;
}

const STATUS_VARIANT: Record<AppointmentStatus, "default" | "secondary" | "destructive" | "outline"> = {
  booked: "secondary",
  confirmed: "default",
  cancelled: "destructive",
  completed: "outline",
  no_show: "destructive",
};

export default function ClientDashboardPage() {
  const t = useTranslations("auth.dashboard");
  const tCommon = useTranslations("common");
  const router = useRouter();

  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [telegramChatId, setTelegramChatId] = useState<string | null | undefined>(undefined);
  const [telegramUrl, setTelegramUrl] = useState<string | null>(null);
  const [loadingTelegramLink, setLoadingTelegramLink] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch("/api/client/appointments"),
      fetch("/api/client/profile"),
    ]).then(async ([aptsRes, profileRes]) => {
      if (aptsRes.status === 401) { router.push("/login"); return; }
      const aptsData = await aptsRes.json().catch(() => null);
      if (aptsData) setData(aptsData);
      if (profileRes.ok) {
        const profile = await profileRes.json().catch(() => null);
        setTelegramChatId(profile?.telegramChatId ?? null);
      }
    }).catch(() => {}).finally(() => setLoading(false));
  }, [router]);

  async function handleConfirm(id: string) {
    if (!confirm(t("confirmConfirm"))) return;
    setConfirmingId(id);
    try {
      const res = await fetch(`/api/client/appointments/${id}/confirm`, { method: "POST" });
      if (res.ok) {
        setData((prev) =>
          prev
            ? {
                ...prev,
                appointments: prev.appointments.map((a) =>
                  a.id === id ? { ...a, status: "confirmed" as const } : a
                ),
              }
            : prev
        );
      }
    } finally {
      setConfirmingId(null);
    }
  }

  async function handleCancel(id: string) {
    if (!confirm(t("cancelConfirm"))) return;
    setCancellingId(id);
    try {
      const res = await fetch(`/api/client/appointments/${id}/cancel`, { method: "POST" });
      if (res.ok) {
        setData((prev) =>
          prev
            ? {
                ...prev,
                appointments: prev.appointments.filter((a) => a.id !== id),
              }
            : prev
        );
      }
    } finally {
      setCancellingId(null);
    }
  }

  async function handleConnectTelegram() {
    if (telegramUrl) return; // already generated — just show it
    setLoadingTelegramLink(true);
    try {
      const res = await fetch("/api/client/telegram-link", { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        setTelegramUrl(data.telegramUrl);
      }
    } finally {
      setLoadingTelegramLink(false);
    }
  }

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  }

  return (
    <div className="flex flex-col min-h-screen">
      <header className="flex items-center justify-between px-6 py-4 border-b">
        <h1 className="text-lg font-semibold">{t("title")}</h1>
        <div className="flex items-center gap-2">
          <LanguageSwitcher />
          <Button variant="ghost" size="sm" onClick={handleLogout}>
            {t("logout")}
          </Button>
        </div>
      </header>

      <main className="flex-1 px-4 py-8 max-w-2xl mx-auto w-full">
        <div className="space-y-6">

        {/* Connect Telegram banner — shown only when telegramChatId is null */}
        {telegramChatId === null && (
          <div className="rounded-lg border bg-muted/40 p-4 space-y-3 text-center">
            <p className="font-medium text-sm">{t("connectTelegramTitle")}</p>
            <p className="text-xs text-muted-foreground">{t("connectTelegramDesc")}</p>
            {!telegramUrl ? (
              <Button
                size="sm"
                className="w-full"
                disabled={loadingTelegramLink}
                onClick={handleConnectTelegram}
              >
                {loadingTelegramLink ? tCommon("loading") : t("connectTelegramBtn")}
              </Button>
            ) : (
              <div className="space-y-3">
                <a href={telegramUrl} target="_blank" rel="noopener noreferrer" className="block">
                  <Button size="sm" className="w-full">{t("connectTelegramBtn")}</Button>
                </a>
                <p className="text-xs text-muted-foreground">{t("connectTelegramQr")}</p>
                <div className="flex justify-center">
                  <QRCodeSVG value={telegramUrl} size={140} className="rounded-lg border p-2 bg-white" />
                </div>
              </div>
            )}
          </div>
        )}

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">{t("upcoming")}</h2>
            <Link href="/book">
              <Button size="sm">{t("bookNew")}</Button>
            </Link>
          </div>

          {loading && (
            <p className="text-muted-foreground text-sm">{tCommon("loading")}</p>
          )}

          {!loading && data?.appointments.length === 0 && (
            <p className="text-muted-foreground text-sm">{t("noAppointments")}</p>
          )}

          {data?.appointments.map((apt) => {
            const dt = new Date(apt.dateTime);
            const tz = data.timezone || "Europe/Kyiv";
            const dateStr = formatInTimeZone(dt, tz, "dd.MM.yyyy HH:mm");

            return (
              <div
                key={apt.id}
                className="flex items-center justify-between p-4 rounded-lg border"
              >
                <div className="space-y-1">
                  <p className="font-medium">{dateStr}</p>
                  <Badge variant={STATUS_VARIANT[apt.status]}>
                    {t(`status.${apt.status}`)}
                  </Badge>
                </div>
                <div className="flex gap-2 flex-wrap justify-end">
                  {apt.status === "booked" && (
                    <Button
                      variant="default"
                      size="sm"
                      disabled={confirmingId === apt.id}
                      onClick={() => handleConfirm(apt.id)}
                    >
                      {t("confirm")}
                    </Button>
                  )}
                  <Link href={`/client/reschedule/${apt.id}`}>
                    <Button variant="outline" size="sm">
                      {t("reschedule")}
                    </Button>
                  </Link>
                  <Button
                    variant="destructive"
                    size="sm"
                    disabled={cancellingId === apt.id}
                    onClick={() => handleCancel(apt.id)}
                  >
                    {t("cancel")}
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
        </div>
      </main>
    </div>
  );
}
