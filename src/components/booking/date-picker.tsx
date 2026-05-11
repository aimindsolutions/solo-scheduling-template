"use client";

import { useTranslations } from "next-intl";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { format, isBefore, startOfDay } from "date-fns";

interface BookingDatePickerProps {
  selectedDate: string | null;
  onSelectDate: (date: string) => void;
}

export function BookingDatePicker({
  selectedDate,
  onSelectDate,
}: BookingDatePickerProps) {
  const t = useTranslations("booking");

  const selected = selectedDate ? new Date(selectedDate) : undefined;
  const today = startOfDay(new Date());

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t("selectDate")}</CardTitle>
      </CardHeader>
      <CardContent className="flex justify-center">
        <Calendar
          mode="single"
          selected={selected}
          onSelect={(date) => {
            if (date) {
              onSelectDate(format(date, "yyyy-MM-dd"));
            }
          }}
          disabled={(date) => isBefore(date, today)}
        />
      </CardContent>
    </Card>
  );
}
