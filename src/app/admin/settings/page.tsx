"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { adminFetch } from "@/lib/api-client";
import { TIMEZONES } from "@/lib/date-utils";
import { Trash2, Plus } from "lucide-react";

const DAYS = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
];

interface WorkingHours {
  [day: string]: { start: string; end: string } | null;
}

interface BreakSlot {
  start: string;
  end: string;
}

interface VacationDay {
  id: string;
  startDate: string;
  endDate: string;
  reason?: string;
}

export default function AdminSettingsPage() {
  const [businessName, setBusinessName] = useState("");
  const [serviceName, setServiceName] = useState("");
  const [duration, setDuration] = useState("30");
  const [timezone, setTimezone] = useState("Europe/Kyiv");
  const [workingHours, setWorkingHours] = useState<WorkingHours>({});
  const [breakSlots, setBreakSlots] = useState<BreakSlot[]>([]);
  const [vacationDays, setVacationDays] = useState<VacationDay[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    async function fetchConfig() {
      try {
        const res = await adminFetch("/api/config");
        const data = await res.json();
        if (data.config) {
          setBusinessName(data.config.businessName || "");
          setServiceName(data.config.serviceName || "");
          setDuration(String(data.config.defaultDurationMinutes || 30));
          setTimezone(data.config.timezone || "Europe/Kyiv");
          setWorkingHours(data.config.workingHours || {});
          setBreakSlots(data.config.breakSlots || []);
          setVacationDays(data.config.vacationDays || []);
        }
      } catch {
        // default values
      } finally {
        setLoading(false);
      }
    }
    fetchConfig();
  }, []);

  function updateDayHours(day: string, field: "start" | "end", value: string) {
    setWorkingHours((prev) => ({
      ...prev,
      [day]: { ...((prev[day] as { start: string; end: string }) || { start: "09:00", end: "18:00" }), [field]: value },
    }));
  }

  function toggleDay(day: string) {
    setWorkingHours((prev) => ({
      ...prev,
      [day]: prev[day] ? null : { start: "09:00", end: "18:00" },
    }));
  }

  function addBreakSlot() {
    setBreakSlots((prev) => [...prev, { start: "13:00", end: "14:00" }]);
  }

  function updateBreakSlot(index: number, field: "start" | "end", value: string) {
    setBreakSlots((prev) =>
      prev.map((slot, i) => (i === index ? { ...slot, [field]: value } : slot))
    );
  }

  function removeBreakSlot(index: number) {
    setBreakSlots((prev) => prev.filter((_, i) => i !== index));
  }

  function addVacation() {
    const today = new Date().toISOString().slice(0, 10);
    setVacationDays((prev) => [
      ...prev,
      { id: crypto.randomUUID(), startDate: today, endDate: today, reason: "" },
    ]);
  }

  function updateVacation(id: string, field: keyof VacationDay, value: string) {
    setVacationDays((prev) =>
      prev.map((v) => (v.id === id ? { ...v, [field]: value } : v))
    );
  }

  function removeVacation(id: string) {
    setVacationDays((prev) => prev.filter((v) => v.id !== id));
  }

  async function handleSave() {
    setSaving(true);
    setMessage("");
    try {
      const res = await adminFetch("/api/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessName,
          serviceName,
          defaultDurationMinutes: parseInt(duration),
          timezone,
          workingHours,
          breakSlots,
          vacationDays,
        }),
      });
      if (res.ok) {
        setMessage("Settings saved!");
      } else {
        const body = await res.json().catch(() => ({}));
        setMessage(body.error || "Failed to save settings");
      }
    } catch {
      setMessage("Failed to save settings");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="text-muted-foreground">Loading...</div>;

  return (
    <div className="space-y-6 max-w-2xl">
      <h1 className="text-2xl font-bold">Settings</h1>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Business Info</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Business Name</Label>
            <Input
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
              placeholder="My Business"
            />
          </div>
          <div className="space-y-2">
            <Label>Service Name</Label>
            <Input
              value={serviceName}
              onChange={(e) => setServiceName(e.target.value)}
              placeholder="Consultation"
            />
          </div>
          <div className="space-y-2">
            <Label>Default Duration (minutes)</Label>
            <Select value={duration} onValueChange={(v) => v && setDuration(v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="15">15 min</SelectItem>
                <SelectItem value="30">30 min</SelectItem>
                <SelectItem value="45">45 min</SelectItem>
                <SelectItem value="60">60 min</SelectItem>
                <SelectItem value="90">90 min</SelectItem>
                <SelectItem value="120">120 min</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Timezone</Label>
            <Select value={timezone} onValueChange={(v) => v && setTimezone(v)}>
              <SelectTrigger>
                <SelectValue placeholder="Select timezone" />
              </SelectTrigger>
              <SelectContent className="max-h-60">
                {TIMEZONES.map((tz) => (
                  <SelectItem key={tz} value={tz}>
                    {tz.replace(/_/g, " ")}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Working Hours</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {DAYS.map((day) => {
            const hours = workingHours[day];
            const isActive = !!hours;
            return (
              <div key={day} className="flex items-center gap-3">
                <Button
                  variant={isActive ? "default" : "outline"}
                  size="sm"
                  className="w-24 text-xs capitalize"
                  onClick={() => toggleDay(day)}
                >
                  {day.slice(0, 3)}
                </Button>
                {isActive && hours ? (
                  <>
                    <Input
                      type="time"
                      value={hours.start}
                      onChange={(e) => updateDayHours(day, "start", e.target.value)}
                      className="w-28"
                    />
                    <span className="text-muted-foreground">—</span>
                    <Input
                      type="time"
                      value={hours.end}
                      onChange={(e) => updateDayHours(day, "end", e.target.value)}
                      className="w-28"
                    />
                  </>
                ) : (
                  <span className="text-sm text-muted-foreground">Day off</span>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Break Times</CardTitle>
          <Button variant="outline" size="sm" onClick={addBreakSlot}>
            <Plus className="h-3.5 w-3.5 mr-1" /> Add Break
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {breakSlots.length === 0 ? (
            <p className="text-sm text-muted-foreground">No breaks configured</p>
          ) : (
            breakSlots.map((slot, index) => (
              <div key={index} className="flex items-center gap-3">
                <Input
                  type="time"
                  value={slot.start}
                  onChange={(e) => updateBreakSlot(index, "start", e.target.value)}
                  className="w-28"
                />
                <span className="text-muted-foreground">—</span>
                <Input
                  type="time"
                  value={slot.end}
                  onChange={(e) => updateBreakSlot(index, "end", e.target.value)}
                  className="w-28"
                />
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-destructive hover:text-destructive"
                  onClick={() => removeBreakSlot(index)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Vacation Days</CardTitle>
          <Button variant="outline" size="sm" onClick={addVacation}>
            <Plus className="h-3.5 w-3.5 mr-1" /> Add Vacation
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {vacationDays.length === 0 ? (
            <p className="text-sm text-muted-foreground">No vacation days configured</p>
          ) : (
            <div className="space-y-3">
              <div className="hidden sm:grid grid-cols-[1fr_1fr_1fr_40px] gap-3 text-xs text-muted-foreground font-medium">
                <span>Start Date</span>
                <span>End Date</span>
                <span>Reason</span>
                <span />
              </div>
              {vacationDays.map((vacation) => (
                <div key={vacation.id} className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_1fr_40px] gap-2 sm:gap-3 items-center border sm:border-0 rounded-lg sm:rounded-none p-3 sm:p-0">
                  <Input
                    type="date"
                    value={vacation.startDate}
                    onChange={(e) => updateVacation(vacation.id, "startDate", e.target.value)}
                  />
                  <Input
                    type="date"
                    value={vacation.endDate}
                    onChange={(e) => updateVacation(vacation.id, "endDate", e.target.value)}
                  />
                  <Input
                    value={vacation.reason || ""}
                    onChange={(e) => updateVacation(vacation.id, "reason", e.target.value)}
                    placeholder="Reason (optional)"
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive hover:text-destructive"
                    onClick={() => removeVacation(vacation.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {message && (
        <p className={`text-sm ${message.includes("Failed") ? "text-destructive" : "text-green-600 dark:text-green-400"}`}>
          {message}
        </p>
      )}

      <Button onClick={handleSave} disabled={saving}>
        {saving ? "Saving..." : "Save Settings"}
      </Button>
    </div>
  );
}
