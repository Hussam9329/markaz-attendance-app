export const DEFAULT_TIMEZONE = "Asia/Baghdad";

export type LocalParts = {
  date: string;
  time: string;
};

export function getLocalParts(date: Date, timeZone = DEFAULT_TIMEZONE): LocalParts {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23"
  }).formatToParts(date);

  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "00";

  return {
    date: `${get("year")}-${get("month")}-${get("day")}`,
    time: `${get("hour")}:${get("minute")}:${get("second")}`
  };
}

export function calculateLateMinutes(localTime: string, lateAfterTime: string) {
  const toSeconds = (value: string) => {
    const [h = "0", m = "0", s = "0"] = value.split(":");
    return Number(h) * 3600 + Number(m) * 60 + Number(s);
  };

  const diffSeconds = toSeconds(localTime) - toSeconds(lateAfterTime);
  if (diffSeconds <= 0) return 0;
  return Math.ceil(diffSeconds / 60);
}

export function currentMonth(timeZone = DEFAULT_TIMEZONE) {
  return getLocalParts(new Date(), timeZone).date.slice(0, 7);
}

export function monthBounds(month: string) {
  const [year, monthNumber] = month.split("-").map(Number);
  if (!year || !monthNumber || monthNumber < 1 || monthNumber > 12) {
    throw new Error("Invalid month. Use YYYY-MM.");
  }

  const start = `${year}-${String(monthNumber).padStart(2, "0")}-01`;
  const endDate = new Date(Date.UTC(year, monthNumber, 1));
  const end = `${endDate.getUTCFullYear()}-${String(endDate.getUTCMonth() + 1).padStart(2, "0")}-01`;
  return { start, end };
}
