"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { ArrowLeft } from "lucide-react";
import { normalizePhone } from "@/lib/utils";
import { getGoogleIdToken, signInWithGoogleRedirect, getGoogleIdTokenFromRedirect } from "@/lib/firebase/auth";
import { LanguageSwitcher } from "@/components/shared/language-switcher";

export default function RegisterPage() {
  const t = useTranslations("auth.register");
  const tCommon = useTranslations("common");
  const router = useRouter();

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [consent, setConsent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function handleRedirectReturn() {
      try {
        const idToken = await getGoogleIdTokenFromRedirect();
        if (!idToken) return;
        setLoading(true);
        const res = await fetch("/api/auth/google-login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ idToken }),
        });
        if (res.ok) {
          router.push("/client/dashboard");
        } else {
          setError(t("errors.googleFailed"));
          setLoading(false);
        }
      } catch {
        // No pending redirect result — normal page load, do nothing
      }
    }
    handleRedirectReturn();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleGoogleRegister() {
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
    } catch (err) {
      const code = (err as { code?: string }).code;
      if (code === "auth/popup-blocked") {
        await signInWithGoogleRedirect();
        return; // browser navigates away
      }
      setError(t("errors.googleFailed"));
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!consent) {
      setError(t("consentRequired"));
      return;
    }
    setError(null);
    setLoading(true);

    const normalizedPhone = normalizePhone(phone);

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          phone: normalizedPhone,
          email: email || undefined,
          consentText: t("consent"),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        if (data.status === "phone_exists") {
          setError(t("errors.phoneExists"));
        } else {
          setError(t("errors.generic"));
        }
        return;
      }

      // Account created — go to verify page
      const params = new URLSearchParams({
        phone: normalizedPhone,
        rememberMe: "false",
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
        <div className="ml-auto"><LanguageSwitcher /></div>
      </header>

      <main className="flex-1 flex items-center justify-center px-4">
        <div className="w-full max-w-sm space-y-6">
          <div className="space-y-1">
            <h2 className="text-2xl font-bold">{t("title")}</h2>
            <p className="text-muted-foreground">{t("subtitle")}</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">{t("name")}</Label>
              <Input
                id="name"
                type="text"
                placeholder={t("namePlaceholder")}
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                autoComplete="name"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">{t("phone")}</Label>
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

            <div className="space-y-2">
              <Label htmlFor="email">{t("email")}</Label>
              <Input
                id="email"
                type="email"
                placeholder={t("emailPlaceholder")}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
              />
            </div>

            <div className="flex items-start gap-2">
              <Checkbox
                id="consent"
                checked={consent}
                onCheckedChange={(v) => setConsent(!!v)}
                className="mt-0.5"
              />
              <Label htmlFor="consent" className="font-normal text-sm leading-relaxed cursor-pointer">
                {t("consent")}
              </Label>
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}

            <Button type="submit" className="w-full" disabled={loading || !consent}>
              {loading ? tCommon("loading") : t("submit")}
            </Button>
          </form>

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
            onClick={handleGoogleRegister}
            disabled={loading}
          >
            {t("continueWithGoogle")}
          </Button>

          <p className="text-center text-sm text-muted-foreground">
            {t("alreadyAccount")}{" "}
            <Link href="/login" className="text-primary underline underline-offset-4">
              {t("login")}
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}
