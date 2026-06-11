"use client";

import { useEffect, useMemo, useState } from "react";

import type { DailyLifeRecord, DailyLifeScheduleEntry } from "../lib/types";

function istanbulClock(): { time: string; minutes: number } {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Istanbul",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).formatToParts(new Date());
  const hour = Number(parts.find((part) => part.type === "hour")?.value ?? 0);
  const minute = Number(parts.find((part) => part.type === "minute")?.value ?? 0);
  return { time: `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`, minutes: hour * 60 + minute };
}

function scheduleMinutes(entry: DailyLifeScheduleEntry): number {
  const [hour, minute] = entry.time.split(":").map(Number);
  return hour * 60 + minute;
}

export function CurrentStatePanel({
  dailyLife,
  historical = false
}: {
  dailyLife: DailyLifeRecord;
  historical?: boolean;
}) {
  const [clock, setClock] = useState({ time: "--:--", minutes: 0 });

  useEffect(() => {
    if (historical) return;
    setClock(istanbulClock());
    const timer = window.setInterval(() => setClock(istanbulClock()), 60_000);
    return () => window.clearInterval(timer);
  }, [historical]);

  const current = useMemo(() => {
    if (historical) {
      return dailyLife.schedule.find((entry) => entry.time === dailyLife.wake_time) ?? dailyLife.schedule[0];
    }
    return [...dailyLife.schedule]
      .sort((a, b) => scheduleMinutes(a) - scheduleMinutes(b))
      .filter((entry) => scheduleMinutes(entry) <= clock.minutes)
      .at(-1) ?? dailyLife.schedule[0];
  }, [clock.minutes, dailyLife.schedule, dailyLife.wake_time, historical]);

  return (
    <section className="consciousness-module current-state-module">
      <div className="consciousness-heading">
        <h2>{historical ? "o günkü hâli" : "ucu beden şu an"}</h2>
        <span>{historical ? dailyLife.date : `${clock.time} / İstanbul`}</span>
      </div>
      <p className="current-activity">{current?.activity ?? dailyLife.activity}</p>
      <dl className="state-list">
        <div><dt>ruh hali</dt><dd>{dailyLife.mood}</dd></div>
        <div><dt>enerji</dt><dd>{dailyLife.energy < 0.35 ? "dipte" : dailyLife.energy < 0.65 ? "ölçülü" : "açık"}</dd></div>
        <div><dt>takıntısı</dt><dd>{dailyLife.obsession}</dd></div>
        <div><dt>kaçındığı</dt><dd>{dailyLife.avoidance}</dd></div>
      </dl>
      <p className="inner-note">“{current?.inner_note ?? dailyLife.inner_note}”</p>
    </section>
  );
}
