"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { BookingDatePicker } from "@/components/booking/date-picker";
import { BookingTimeSlots } from "@/components/booking/time-slots";
import { use } from "react";
import { LanguageSwitcher } from "@/components/shared/language-switcher";

export default function ReschedulePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const t = useTranslations("auth.dashboard");
  const tCommon = useTranslations("common");
  const router = useRouter();

  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleConfirm() {
    if (!selectedDate || !selectedTime) return;
    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch(`/api/client/appointments/${id}/reschedule`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: selectedDate, time: selectedTime }),
      });

      if (res.ok) {
        router.push("/client/dashboard");
      } else if (res.status === 409) {
        setError(t("slotTaken"));
      } else {
        setError(tCommon("error"));
      }
    } catch {
      setError(tCommon("error"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col min-h-screen">
      <header className="flex items-center gap-4 px-6 py-4 border-b">
        <Link href="/client/dashboard">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <h1 className="text-lg font-semibold">{t("reschedule")}</h1>
        <div className="ml-auto"><LanguageSwitcher /></div>
      </header>

      <main className="flex-1 flex justify-center px-4 py-8">
        <div className="w-full max-w-lg space-y-6">
          <BookingDatePicker
            selectedDate={selectedDate}
            onSelectDate={(date) => {
              setSelectedDate(date);
              setSelectedTime(null);
            }}
          />

          {selectedDate && (
            <BookingTimeSlots
              date={selectedDate}
              selectedTime={selectedTime}
              onSelectTime={setSelectedTime}
            />
          )}

          {error && <p className="text-sm text-destructive">{error}</p>}

          {selectedDate && selectedTime && (
            <Button className="w-full" onClick={handleConfirm} disabled={submitting}>
              {submitting ? tCommon("loading") : tCommon("confirm")}
            </Button>
          )}
        </div>
      </main>
    </div>
  );
}
