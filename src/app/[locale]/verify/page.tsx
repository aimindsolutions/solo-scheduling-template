"use client";

import { useEffect, useState, useCallback } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Loader2 } from "lucide-react";
import { useSearchParams } from "next/navigation";

const RESEND_COOLDOWN = 60; // seconds
const POLL_INTERVAL = 3000; // ms

export default function VerifyPage() {
  const t = useTranslations("auth.verify");
  const router = useRouter();
  const searchParams = useSearchParams();

  const phone = searchParams.get("phone") ?? "";
  const rememberMe = searchParams.get("rememberMe") === "true";
  const verifyToken = searchParams.get("token") ?? "";
  const telegramUrlParam = searchParams.get("telegramUrl") ?? "";

  const [status, setStatus] = useState<"waiting" | "success" | "error">("waiting");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [resendCooldown, setResendCooldown] = useState(RESEND_COOLDOWN);
  const [telegramUrl, setTelegramUrl] = useState(telegramUrlParam);

  // Poll for verification by checking the token status
  useEffect(() => {
    if (status !== "waiting" || !verifyToken) return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/auth/client-session?verifyToken=${verifyToken}`, {
          method: "GET",
        });
        if (res.ok) {
          setStatus("success");
          clearInterval(interval);
          setTimeout(() => router.push("/client/dashboard"), 1000);
        }
      } catch {}
    }, POLL_INTERVAL);

    return () => clearInterval(interval);
  }, [status, router, verifyToken]);

  // Resend cooldown countdown
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setTimeout(() => setResendCooldown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendCooldown]);

  const handleResend = useCallback(async () => {
    if (resendCooldown > 0 || !phone) return;
    setResendCooldown(RESEND_COOLDOWN);
    setErrorMsg(null);

    try {
      const res = await fetch("/api/auth/phone-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, rememberMe }),
      });
      const d = await res.json();
      if (d.telegramUrl) setTelegramUrl(d.telegramUrl);
    } catch {
      setErrorMsg(t("errors.generic"));
    }
  }, [phone, rememberMe, resendCooldown, t]);

  return (
    <div className="flex flex-col min-h-screen">
      <header className="flex items-center gap-4 px-6 py-4 border-b">
        <Link href="/login">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <h1 className="text-lg font-semibold">{t("title")}</h1>
      </header>

      <main className="flex-1 flex items-center justify-center px-4">
        <div className="w-full max-w-sm space-y-6 text-center">
          {status === "success" ? (
            <p className="text-lg font-medium text-green-600 dark:text-green-400">
              {t("success")}
            </p>
          ) : (
            <>
              <div className="space-y-2">
                <h2 className="text-2xl font-bold">{t("telegramTitle")}</h2>
                <p className="text-muted-foreground">{t("telegramInstructions")}</p>
              </div>

              {telegramUrl && (
                <a href={telegramUrl} target="_blank" rel="noopener noreferrer">
                  <Button size="lg" className="w-full">
                    {t("openTelegram")}
                  </Button>
                </a>
              )}

              <div className="flex items-center justify-center gap-2 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-sm">{t("waiting")}</span>
              </div>

              {errorMsg && <p className="text-sm text-destructive">{errorMsg}</p>}

              <Button
                variant="ghost"
                size="sm"
                onClick={handleResend}
                disabled={resendCooldown > 0}
              >
                {resendCooldown > 0
                  ? t("resendIn", { seconds: resendCooldown })
                  : t("resend")}
              </Button>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
