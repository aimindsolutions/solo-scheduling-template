"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { adminFetch } from "@/lib/api-client";

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

export default function AdminSettingsPage() {
  const [businessName, setBusinessName] = useState("");
  const [serviceName, setServiceName] = useState("");
  const [duration, setDuration] = useState("30");
  const [timezone, setTimezone] = useState("Europe/Kyiv");
  const [workingHours, setWorkingHours] = useState<WorkingHours>({});
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
        }),
      });
      if (res.ok) {
        setMessage("Settings saved!");
      } else {
        setMessage("Failed to save settings");
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
            <Input
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              placeholder="Europe/Kyiv"
            />
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
