"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface BookingTimeSlotsProps {
  date: string;
  selectedTime: string | null;
  onSelectTime: (time: string) => void;
}

export function BookingTimeSlots({
  date,
  selectedTime,
  onSelectTime,
}: BookingTimeSlotsProps) {
  const t = useTranslations("booking");
  const [slots, setSlots] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function fetchSlots() {
      setLoading(true);
      try {
        const res = await fetch(`/api/appointments/slots?date=${date}`);
        const data = await res.json();
        setSlots(data.slots || []);
      } catch {
        setSlots([]);
      } finally {
        setLoading(false);
      }
    }
    fetchSlots();
  }, [date]);

  if (loading) {
    return (
      <Card>
        <CardContent className="py-6 text-center text-muted-foreground">
          {t("selectTime")}...
        </CardContent>
      </Card>
    );
  }

  if (slots.length === 0) {
    return (
      <Card>
        <CardContent className="py-6 text-center text-muted-foreground">
          {t("noSlots")}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t("selectTime")}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-4 gap-2">
          {slots.map((slot) => (
            <Button
              key={slot}
              variant={selectedTime === slot ? "default" : "outline"}
              size="sm"
              className={cn("text-sm")}
              onClick={() => onSelectTime(slot)}
            >
              {slot}
            </Button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
