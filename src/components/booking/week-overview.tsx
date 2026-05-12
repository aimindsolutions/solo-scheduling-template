"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { format, startOfWeek, addDays, isSameDay, isBefore, startOfDay } from "date-fns";
import { uk, enUS } from "date-fns/locale";
import { useLocale } from "next-intl";

interface WeekOverviewProps {
  selectedDate: string | null;
  selectedTime: string | null;
  onSelectSlot: (date: string, time: string) => void;
}

interface DaySlots {
  date: string;
  slots: string[];
  loading: boolean;
}

export function WeekOverview({
  selectedDate,
  selectedTime,
  onSelectSlot,
}: WeekOverviewProps) {
  const t = useTranslations("booking");
  const locale = useLocale();
  const dateLocale = locale === "uk" ? uk : enUS;

  const referenceDate = selectedDate ? new Date(selectedDate) : new Date();
  const weekStart = startOfWeek(referenceDate, { weekStartsOn: 1 });
  const today = startOfDay(new Date());

  const days = Array.from({ length: 7 }, (_, i) => {
    const d = addDays(weekStart, i);
    return format(d, "yyyy-MM-dd");
  });

  const [weekSlots, setWeekSlots] = useState<DaySlots[]>([]);

  useEffect(() => {
    const futureDays = days.filter((d) => !isBefore(new Date(d), today));

    setWeekSlots(
      days.map((d) => ({
        date: d,
        slots: [],
        loading: futureDays.includes(d),
      }))
    );

    async function fetchAll() {
      const results = await Promise.all(
        futureDays.map(async (d) => {
          try {
            const res = await fetch(`/api/appointments/slots?date=${d}`);
            const data = await res.json();
            return { date: d, slots: (data.slots || []) as string[] };
          } catch {
            return { date: d, slots: [] };
          }
        })
      );

      setWeekSlots(
        days.map((d) => {
          const found = results.find((r) => r.date === d);
          return {
            date: d,
            slots: found?.slots || [],
            loading: false,
          };
        })
      );
    }

    fetchAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weekStart.toISOString()]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">
{t("weekOverview")}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2">
          {weekSlots.map((day) => {
            const date = new Date(day.date);
            const isPast = isBefore(date, today);
            const isSelected = selectedDate === day.date;
            const isToday = isSameDay(date, today);

            return (
              <div
                key={day.date}
                className={cn(
                  "border rounded-lg p-2 min-h-[120px]",
                  isPast && "opacity-40",
                  isSelected && "border-primary ring-1 ring-primary",
                  isToday && !isSelected && "border-primary/50"
                )}
              >
                <p
                  className={cn(
                    "text-xs font-medium text-center mb-2",
                    isToday ? "text-primary" : "text-muted-foreground"
                  )}
                >
                  {format(date, "EEE d", { locale: dateLocale })}
                </p>

                {day.loading ? (
                  <p className="text-xs text-muted-foreground text-center">...</p>
                ) : isPast ? (
                  <p className="text-xs text-muted-foreground text-center">—</p>
                ) : day.slots.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center">—</p>
                ) : (
                  <div className="flex flex-col gap-1">
                    {day.slots.map((slot) => (
                      <Button
                        key={slot}
                        variant={
                          selectedDate === day.date && selectedTime === slot
                            ? "default"
                            : "outline"
                        }
                        size="sm"
                        className="h-7 text-xs w-full"
                        onClick={() => onSelectSlot(day.date, slot)}
                      >
                        {slot}
                      </Button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
