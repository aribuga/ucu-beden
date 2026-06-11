"use client";

import type { CSSProperties } from "react";
import { useEffect, useMemo, useState } from "react";

type DayCycleStyle = CSSProperties & {
  "--day-position": string;
};

function istanbulTime(): { label: string; hour: number; minute: number } {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Istanbul",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).formatToParts(new Date());
  const hour = Number(parts.find((part) => part.type === "hour")?.value ?? 0);
  const minute = Number(parts.find((part) => part.type === "minute")?.value ?? 0);
  return { label: `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`, hour, minute };
}

function timeFromRecord(value: string | undefined): { label: string; hour: number; minute: number } {
  const match = value?.match(/T(\d{2}):(\d{2})/) ?? value?.match(/^(\d{2}):(\d{2})/);
  const hour = Number(match?.[1] ?? 12);
  const minute = Number(match?.[2] ?? 0);
  return { label: `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`, hour, minute };
}

function phaseFor(hour: number): string {
  if (hour >= 5 && hour < 10) return "sabah";
  if (hour >= 10 && hour < 14) return "öğle";
  if (hour >= 14 && hour < 18) return "akşamüstü";
  if (hour >= 18 && hour < 22) return "rüyaya yakın";
  return "gece";
}

export function DayCyclePanel({ historical = false, recordedTime }: { historical?: boolean; recordedTime?: string }) {
  const [time, setTime] = useState({ label: "--:--", hour: 0, minute: 0 });

  useEffect(() => {
    if (historical) {
      setTime(timeFromRecord(recordedTime));
      return;
    }
    setTime(istanbulTime());
    const timer = window.setInterval(() => setTime(istanbulTime()), 60_000);
    return () => window.clearInterval(timer);
  }, [historical, recordedTime]);

  const cycle = useMemo(() => {
    const progress = (time.hour * 60 + time.minute) / (24 * 60);
    const rightToLeft = 94 - progress * 88;
    const isDay = time.hour >= 6 && time.hour < 19;
    return {
      icon: isDay ? "☼" : "☾",
      phase: phaseFor(time.hour),
      style: { "--day-position": `${rightToLeft}%` } as DayCycleStyle
    };
  }, [time.hour, time.minute]);

  return (
    <section className="consciousness-module day-cycle-module">
      <div className="consciousness-heading">
        <h2>{historical ? "o günün zamanı" : "gün döngüsü"}</h2>
        <span>{time.label} / İstanbul</span>
      </div>
      <div className="day-cycle-track" style={cycle.style} aria-label={`Günün evresi: ${cycle.phase}`}>
        <span className="day-cycle-icon" aria-hidden="true">{cycle.icon}</span>
        <span className="day-cycle-line" aria-hidden="true" />
      </div>
      <div className="day-cycle-meta">
        <span>{cycle.phase}</span>
        <span>{historical ? "kayıtlı an" : "sağdan sola"}</span>
      </div>
    </section>
  );
}
