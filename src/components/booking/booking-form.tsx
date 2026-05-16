"use client";

import { useState, useEffect } from "react";
import { useTranslations, useLocale } from "next-intl";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { bookingFormSchema } from "@/lib/validators";
import { normalizePhone } from "@/lib/utils";

const LS_KEY = "solo_client_data";

interface SavedClientData {
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
}

interface ClientProfile {
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
}

interface BookingFormProps {
  date: string;
  time: string;
  onSuccess: (appointmentId: string) => void;
  clientProfile?: ClientProfile;
}

export function BookingForm({ date, time, onSuccess, clientProfile }: BookingFormProps) {
  const t = useTranslations();
  const locale = useLocale();
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [savedData, setSavedData] = useState<SavedClientData | null>(null);

  const [formData, setFormData] = useState({
    firstName: clientProfile?.firstName ?? "",
    lastName: clientProfile?.lastName ?? "",
    phone: clientProfile?.phone ?? "",
    email: clientProfile?.email ?? "",
    notes: "",
    consentGiven: !!clientProfile,
  });

  // Update form when profile loads asynchronously
  useEffect(() => {
    if (clientProfile) {
      setFormData((prev) => ({
        ...prev,
        firstName: clientProfile.firstName,
        lastName: clientProfile.lastName,
        phone: clientProfile.phone,
        email: clientProfile.email,
        consentGiven: true,
      }));
    }
  }, [clientProfile]);

  useEffect(() => {
    if (clientProfile) return; // don't load saved data when logged in
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (raw) setSavedData(JSON.parse(raw) as SavedClientData);
    } catch {}
  }, [clientProfile]);

  function prefillFromSaved() {
    if (!savedData) return;
    setFormData((prev) => ({
      ...prev,
      firstName: savedData.firstName || prev.firstName,
      lastName: savedData.lastName || prev.lastName,
      phone: savedData.phone || prev.phone,
      email: savedData.email || prev.email,
    }));
    setSavedData(null);
  }

  function updateField(field: string, value: string | boolean) {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => ({ ...prev, [field]: "" }));
  }

  function handlePhoneBlur() {
    if (formData.phone) {
      const normalized = normalizePhone(formData.phone);
      setFormData((prev) => ({ ...prev, phone: normalized }));
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrors({});

    const parsed = bookingFormSchema.safeParse({
      ...formData,
      date,
      time,
    });

    if (!parsed.success) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const field = issue.path[0] as string;
        fieldErrors[field] = t(`validation.${issue.message}`);
      }
      setErrors(fieldErrors);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/appointments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...parsed.data, locale }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to create appointment");
      }

      const data = await res.json();
      try {
        localStorage.setItem(LS_KEY, JSON.stringify({
          firstName: formData.firstName,
          lastName: formData.lastName,
          phone: formData.phone,
          email: formData.email,
        }));
      } catch {}
      onSuccess(data.appointmentId);
    } catch (err) {
      setErrors({ form: err instanceof Error ? err.message : "Unknown error" });
    } finally {
      setLoading(false);
    }
  }

  // Logged-in client: show simplified confirmation (no personal info re-entry)
  if (clientProfile) {
    const displayName = [clientProfile.firstName, clientProfile.lastName].filter(Boolean).join(" ");
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{date} — {time}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border bg-muted/40 px-4 py-3 text-sm mb-4 space-y-1">
            <p className="font-medium">{displayName}</p>
            <p className="text-muted-foreground">{clientProfile.phone}</p>
          </div>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="notes">{t("booking.form.notes")}</Label>
              <Input
                id="notes"
                placeholder={t("booking.form.notesPlaceholder")}
                value={formData.notes}
                onChange={(e) => updateField("notes", e.target.value)}
              />
            </div>
            {errors.form && (
              <p className="text-sm text-destructive">{errors.form}</p>
            )}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? t("common.loading") : t("booking.submit")}
            </Button>
          </form>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">
          {date} — {time}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {savedData && (
          <div className="mb-4 flex items-center justify-between gap-3 rounded-lg border border-primary/30 bg-primary/5 px-4 py-3 text-sm">
            <span>{locale === "uk" ? `👋 Повернулися? Заповнити ваші дані (${savedData.firstName})?` : `👋 Welcome back, ${savedData.firstName}! Use your saved info?`}</span>
            <div className="flex gap-2 shrink-0">
              <Button type="button" size="sm" variant="outline" onClick={() => setSavedData(null)}>
                {locale === "uk" ? "Ні" : "No"}
              </Button>
              <Button type="button" size="sm" onClick={prefillFromSaved}>
                {locale === "uk" ? "Так" : "Yes"}
              </Button>
            </div>
          </div>
        )}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="firstName">{t("booking.form.firstName")} *</Label>
            <Input
              id="firstName"
              placeholder={t("booking.form.firstNamePlaceholder")}
              value={formData.firstName}
              onChange={(e) => updateField("firstName", e.target.value)}
            />
            {errors.firstName && (
              <p className="text-sm text-destructive">{errors.firstName}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="lastName">{t("booking.form.lastName")}</Label>
            <Input
              id="lastName"
              placeholder={t("booking.form.lastNamePlaceholder")}
              value={formData.lastName}
              onChange={(e) => updateField("lastName", e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone">{t("booking.form.phone")} *</Label>
            <Input
              id="phone"
              type="tel"
              placeholder={t("booking.form.phonePlaceholder")}
              value={formData.phone}
              onChange={(e) => updateField("phone", e.target.value)}
              onBlur={handlePhoneBlur}
            />
            {errors.phone && (
              <p className="text-sm text-destructive">{errors.phone}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">{t("booking.form.email")}</Label>
            <Input
              id="email"
              type="email"
              placeholder={t("booking.form.emailPlaceholder")}
              value={formData.email}
              onChange={(e) => updateField("email", e.target.value)}
            />
            {errors.email && (
              <p className="text-sm text-destructive">{errors.email}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">{t("booking.form.notes")}</Label>
            <Input
              id="notes"
              placeholder={t("booking.form.notesPlaceholder")}
              value={formData.notes}
              onChange={(e) => updateField("notes", e.target.value)}
            />
          </div>

          <div className="flex items-start gap-3 pt-2">
            <Checkbox
              id="consent"
              checked={formData.consentGiven}
              onCheckedChange={(checked) =>
                updateField("consentGiven", checked === true)
              }
            />
            <Label htmlFor="consent" className="text-sm leading-relaxed">
              {t("booking.consent")}
            </Label>
          </div>
          {errors.consentGiven && (
            <p className="text-sm text-destructive">{errors.consentGiven}</p>
          )}

          {errors.form && (
            <p className="text-sm text-destructive">{errors.form}</p>
          )}

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? t("common.loading") : t("booking.submit")}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
