"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { ArrowLeft } from "lucide-react";
import { normalizePhone } from "@/lib/utils";
import { getGoogleIdToken } from "@/lib/firebase/auth";

export default function LoginPage() {
  const t = useTranslations("auth.login");
  const tCommon = useTranslations("common");
  const tReg = useTranslations("auth.register");
  const router = useRouter();

  const [phone, setPhone] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleGoogleLogin() {
    setError(null);
    setLoading(true);
    try {
      const idToken = await getGoogleIdToken();
      const res = await fetch("/api/auth/google-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken }),
      });
      if (res.ok) {
        router.push("/client/dashboard");
      } else {
        setError(t("errors.googleFailed"));
      }
    } catch {
      setError(t("errors.googleFailed"));
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const normalizedPhone = normalizePhone(phone);

    try {
      const res = await fetch("/api/auth/phone-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: normalizedPhone, rememberMe }),
      });

      const data = await res.json();

      if (!res.ok) {
        if (data.status === "not_found") {
          setError(t("errors.notFound"));
        } else if (data.status === "unverified_no_telegram") {
          setError(t("errors.unverified"));
        } else if (res.status === 429) {
          setError(t("errors.tooManyAttempts"));
        } else {
          setError(t("errors.generic"));
        }
        return;
      }

      const params = new URLSearchParams({
        phone: normalizedPhone,
        rememberMe: String(rememberMe),
        token: data.verifyToken ?? "",
        telegramUrl: data.telegramUrl ?? "",
      });
      router.push(`/verify?${params.toString()}`);
    } catch {
      setError(t("errors.generic"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col min-h-screen">
      <header className="flex items-center gap-4 px-6 py-4 border-b">
        <Link href="/">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <h1 className="text-lg font-semibold">{t("title")}</h1>
      </header>

      <main className="flex-1 flex items-center justify-center px-4">
        <div className="w-full max-w-sm space-y-6">
          <div className="space-y-1">
            <h2 className="text-2xl font-bold">{t("title")}</h2>
            <p className="text-muted-foreground">{t("subtitle")}</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="phone">{tReg("phone")}</Label>
              <Input
                id="phone"
                type="tel"
                placeholder={t("phonePlaceholder")}
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                required
                autoComplete="tel"
              />
            </div>

            <div className="flex items-center gap-2">
              <Checkbox
                id="rememberMe"
                checked={rememberMe}
                onCheckedChange={(v) => setRememberMe(!!v)}
              />
              <Label htmlFor="rememberMe" className="font-normal cursor-pointer">
                {t("rememberMe")}
              </Label>
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? tCommon("loading") : t("submit")}
            </Button>
          </form>

          <p className="text-center text-sm text-muted-foreground">
            {t("noAccount")}{" "}
            <Link href="/register" className="text-primary underline underline-offset-4">
              {t("register")}
            </Link>
          </p>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">{tCommon("or")}</span>
            </div>
          </div>

          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={handleGoogleLogin}
            disabled={loading}
          >
            {t("continueWithGoogle")}
          </Button>
        </div>
      </main>
    </div>
  );
}
