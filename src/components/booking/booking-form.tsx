"use client";

import { useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { bookingFormSchema } from "@/lib/validators";

interface BookingFormProps {
  date: string;
  time: string;
  onSuccess: (appointmentId: string) => void;
}

export function BookingForm({ date, time, onSuccess }: BookingFormProps) {
  const t = useTranslations();
  const locale = useLocale();
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    phone: "",
    email: "",
    notes: "",
    consentGiven: false,
  });

  function updateField(field: string, value: string | boolean) {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => ({ ...prev, [field]: "" }));
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
      onSuccess(data.appointmentId);
    } catch (err) {
      setErrors({ form: err instanceof Error ? err.message : "Unknown error" });
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">
          {date} — {time}
        </CardTitle>
      </CardHeader>
      <CardContent>
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
