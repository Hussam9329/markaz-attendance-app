"use client";

import { useEffect, useState } from "react";

function formatClock(date: Date | null) {
  if (!date) return "--:--:--";
  return new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(date);
}

function formatDate(date: Date | null) {
  if (!date) return "جاري المزامنة";
  return new Intl.DateTimeFormat("ar-EG-u-nu-latn", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

export default function FutureRealtimeClock() {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <div className="future-realtime-clock" dir="ltr" data-react-transfer="future-clock">
      <span>{formatClock(now)}</span>
      <small dir="rtl">{formatDate(now)}</small>
    </div>
  );
}
