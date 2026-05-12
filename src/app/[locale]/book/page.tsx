"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { BookingDatePicker } from "@/components/booking/date-picker";
import { BookingTimeSlots } from "@/components/booking/time-slots";
import { BookingForm } from "@/components/booking/booking-form";
import { WeekOverview } from "@/components/booking/week-overview";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { Link } from "@/i18n/navigation";

export default function BookPage() {
  const t = useTranslations();
  const router = useRouter();
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);

  return (
    <div className="flex flex-col min-h-screen">
      <header className="flex items-center gap-4 px-6 py-4 border-b">
        <Link href="/">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <h1 className="text-lg font-semibold">{t("booking.title")}</h1>
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

          {selectedDate && selectedTime && (
            <BookingForm
              date={selectedDate}
              time={selectedTime}
              onSuccess={(appointmentId) => {
                router.push(
                  `/book/success?id=${appointmentId}&date=${selectedDate}&time=${selectedTime}`
                );
              }}
            />
          )}

          <WeekOverview
            selectedDate={selectedDate}
            selectedTime={selectedTime}
            onSelectSlot={(date, time) => {
              setSelectedDate(date);
              setSelectedTime(time);
            }}
          />
        </div>
      </main>
    </div>
  );
}
