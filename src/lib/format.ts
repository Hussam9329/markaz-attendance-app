const ARABIC_DIGITS = /[٠-٩۰-۹]/g;
const DIGIT_MAP: Record<string, string> = {
  "٠": "0", "١": "1", "٢": "2", "٣": "3", "٤": "4", "٥": "5", "٦": "6", "٧": "7", "٨": "8", "٩": "9",
  "۰": "0", "۱": "1", "۲": "2", "۳": "3", "۴": "4", "۵": "5", "۶": "6", "۷": "7", "۸": "8", "۹": "9",
};

export function toEnglishDigits(value: unknown) {
  return String(value ?? "").replace(ARABIC_DIGITS, (digit) => DIGIT_MAP[digit] ?? digit);
}

export function formatNumber(value: number | string | null | undefined, options?: Intl.NumberFormatOptions) {
  const number = Number(value ?? 0);
  const safeNumber = Number.isFinite(number) ? number : 0;
  return safeNumber.toLocaleString("en-US", options);
}

export function formatMoney(value: number | string | null | undefined) {
  return formatNumber(value, { maximumFractionDigits: 2 });
}

export function formatPercent(value: number | string | null | undefined) {
  return `${formatNumber(value)}%`;
}

export function formatArabicDate(date: Date | string, options: Intl.DateTimeFormatOptions = {}) {
  const dateValue = typeof date === "string" ? new Date(date) : date;
  return toEnglishDigits(dateValue.toLocaleDateString("ar-EG-u-nu-latn", options));
}

export function formatMonthLabel(month: string) {
  return formatArabicDate(`${month}-01T00:00:00`, { month: "long", year: "numeric" });
}
