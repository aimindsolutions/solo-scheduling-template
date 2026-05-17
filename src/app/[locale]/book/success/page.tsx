"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { CheckCircle, Calendar, Download } from "lucide-react";
import { Link, useRouter } from "@/i18n/navigation";
import { LanguageSwitcher } from "@/components/shared/language-switcher";
import { QRCodeSVG } from "qrcode.react";

export default function BookingSuccessPage() {
  const t = useTranslations("booking.success");
  const searchParams = useSearchParams();
  const router = useRouter();

  const date = searchParams.get("date") || "";
  const time = searchParams.get("time") || "";
  const appointmentId = searchParams.get("id") || "";

  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    fetch("/api/client/profile")
      .then((r) => {
        if (r.ok) {
          setIsLoggedIn(true);
          setTimeout(() => router.push("/client/dashboard"), 3000);
        }
      })
      .catch(() => {});
  }, [router]);

  const telegramBotUrl = `https://t.me/${process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME || "your_bot"}?start=${appointmentId}`;
  const googleCalendarUrl = `/api/appointments/${appointmentId}/calendar?type=google`;
  const icsUrl = `/api/appointments/${appointmentId}/calendar?type=ics`;

  return (
    <div className="flex flex-col min-h-screen">
      <header className="flex items-center justify-end px-6 py-4 border-b">
        <LanguageSwitcher />
      </header>

      <main className="flex-1 flex items-center justify-center px-4 py-8">
        <div className="w-full max-w-sm space-y-6 text-center">

          {/* Booking confirmed */}
          <div className="space-y-2">
            <CheckCircle className="h-12 w-12 text-green-500 mx-auto" />
            <h1 className="text-2xl font-bold">{t("title")}</h1>
            <p className="text-muted-foreground">{t("message", { date, time })}</p>
          </div>

          {isLoggedIn ? (
            <Link href="/client/dashboard" className="block">
              <Button className="w-full">{t("backToCabinet")}</Button>
            </Link>
          ) : (
            <>
              {/* Telegram section — matches verify page layout */}
              {appointmentId && (
                <div className="space-y-4">
                  <div className="space-y-1">
                    <p className="text-sm font-medium">{t("telegramConnect")}</p>
                  </div>

                  <a href={telegramBotUrl} target="_blank" rel="noopener noreferrer" className="block">
                    <Button size="lg" className="w-full">
                      {t("openTelegram")}
                    </Button>
                  </a>

                  <div className="space-y-2">
                    <p className="text-xs text-muted-foreground">{t("orScanQr")}</p>
                    <div className="flex justify-center">
                      <QRCodeSVG
                        value={telegramBotUrl}
                        size={160}
                        className="rounded-lg border p-2 bg-white"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Calendar links */}
              <div className="space-y-3 text-left">
                <p className="text-sm font-medium text-center">{t("addToCalendar")}</p>
                <div className="flex gap-2">
                  <a href={googleCalendarUrl} target="_blank" rel="noopener noreferrer" className="flex-1">
                    <Button variant="outline" className="w-full gap-2">
                      <Calendar className="h-4 w-4" />
                      {t("googleCalendar")}
                    </Button>
                  </a>
                  <a href={icsUrl} download className="flex-1">
                    <Button variant="outline" className="w-full gap-2">
                      <Download className="h-4 w-4" />
                      {t("downloadIcs")}
                    </Button>
                  </a>
                </div>
              </div>

              {/* Create account CTA */}
              <div className="rounded-lg border bg-muted/40 px-4 py-3 space-y-2">
                <p className="text-sm text-muted-foreground">{t("createAccountPrompt")}</p>
                <Link href="/register" className="block">
                  <Button variant="outline" className="w-full">{t("createAccount")}</Button>
                </Link>
              </div>

              <Link href="/" className="block">
                <Button variant="ghost" className="w-full">← {t("backToHome")}</Button>
              </Link>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
