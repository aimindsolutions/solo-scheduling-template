"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle, Calendar, Download } from "lucide-react";
import { Link, useRouter } from "@/i18n/navigation";

export default function BookingSuccessPage() {
  const t = useTranslations("booking.success");
  const searchParams = useSearchParams();
  const router = useRouter();

  const date = searchParams.get("date") || "";
  const time = searchParams.get("time") || "";
  const appointmentId = searchParams.get("id") || "";
  const telegramLinked = searchParams.get("linked") === "1";

  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    fetch("/api/client/profile")
      .then((r) => {
        if (r.ok) {
          setIsLoggedIn(true);
          // Auto-redirect to cabinet after 3 seconds
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
      <main className="flex-1 flex items-center justify-center px-4 py-8">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-2" />
            <CardTitle>{t("title")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <p className="text-center text-muted-foreground">
              {t("message", { date, time })}
            </p>

            {!isLoggedIn && telegramLinked && (
              <div className="space-y-3">
                <p className="text-sm font-medium">{t("telegramSent")}</p>
                <a href={telegramBotUrl} target="_blank" rel="noopener noreferrer">
                  <Button className="w-full" variant="default">
                    {t("openTelegram")}
                  </Button>
                </a>
                <Link href="/login" className="block">
                  <Button variant="outline" className="w-full">
                    {t("loginToConfirm")}
                  </Button>
                </Link>
              </div>
            )}

            {!isLoggedIn && !telegramLinked && (
              <div className="space-y-3">
                <p className="text-sm font-medium">{t("telegramPrompt")}</p>
                <a href={telegramBotUrl} target="_blank" rel="noopener noreferrer">
                  <Button className="w-full" variant="default">
                    {t("openTelegram")}
                  </Button>
                </a>
              </div>
            )}

            <div className="space-y-3">
              <p className="text-sm font-medium">{t("addToCalendar")}</p>
              <div className="flex gap-2">
                <a
                  href={googleCalendarUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1"
                >
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

            {isLoggedIn ? (
              <Link href="/client/dashboard" className="block">
                <Button className="w-full">{t("backToCabinet")}</Button>
              </Link>
            ) : (
              <Link href="/" className="block">
                <Button variant="ghost" className="w-full">
                  ← {t("backToHome")}
                </Button>
              </Link>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
