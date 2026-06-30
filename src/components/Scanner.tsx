"use client";

import { Html5QrcodeScanner } from "html5-qrcode";
import { useEffect, useRef, useState } from "react";
import Image from "next/image";

type ScanResponse = {
  ok: boolean;
  message: string;
  duplicate?: boolean;
  employee?: { name: string };
  record?: {
    scannedAt: string;
    localDate: string;
    localTime: string;
    status: "present" | "late";
    lateMinutes: number;
    deduction: number;
  };
};

function extractToken(decodedText: string) {
  const trimmed = decodedText.trim();
  try {
    const parsed = JSON.parse(trimmed) as { token?: string; qr_token?: string };
    if (parsed.token) return parsed.token.trim();
    if (parsed.qr_token) return parsed.qr_token.trim();
  } catch { /* not JSON */ }
  try {
    const url = new URL(trimmed);
    const token = url.searchParams.get("token");
    if (token) return token.trim();
    const parts = url.pathname.split("/").filter(Boolean);
    if (parts.length) return parts[parts.length - 1].trim();
  } catch { /* not a URL */ }
  return trimmed;
}

function formatStatus(data: ScanResponse | null) {
  if (!data?.record) return null;
  if (data.record.status === "late") {
    return `تأخير ${data.record.lateMinutes} دقيقة — الخصم ${data.record.deduction.toLocaleString("en-US")}`;
  }
  return "حضور ضمن الوقت";
}

export default function Scanner({ centerName }: { centerName: string }) {
  const [result, setResult] = useState<ScanResponse | null>(null);
  const [busy, setBusy] = useState(false);
  const lockRef = useRef(false);

  useEffect(() => {
    const scanner = new Html5QrcodeScanner(
      "qr-reader",
      { fps: 10, qrbox: { width: 280, height: 280 }, rememberLastUsedCamera: true },
      false
    );
    scanner.render(
      async (decodedText) => {
        if (lockRef.current) return;
        lockRef.current = true;
        setBusy(true);
        try {
          const token = extractToken(decodedText);
          const response = await fetch("/api/attendance/scan", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ token }),
          });
          const data = (await response.json()) as ScanResponse;
          setResult(data);
        } catch {
          setResult({ ok: false, message: "تعذر تسجيل الحضور. تأكد من الاتصال وحاول مرة ثانية." });
        } finally {
          setBusy(false);
          window.setTimeout(() => { lockRef.current = false; }, 2500);
        }
      },
      () => {}
    );
    return () => { scanner.clear().catch(() => undefined); };
  }, []);

  return (
    <main className="scanner-shell">
      <section className="scanner-card">
        <div className="scanner-header">
          <div className="scanner-brand">
            <Image src="/logo.png" alt="الطاقم TheCrew" width={56} height={56} className="scanner-logo" />
          </div>
          <h1>{centerName}</h1>
          <p>قرّب QR الموظف من الكاميرا لتسجيل الحضور، حساب التأخير، وربط السجل بكشف الراتب تلقائياً</p>
        </div>

        <div className="qr-box" id="qr-reader" />

        <div className={`scan-result ${result?.ok ? "success" : result ? "error" : ""}`}>
          <span className="result-icon">
            {busy ? "⏳" : result?.ok ? "✅" : result ? "❌" : "📷"}
          </span>
          <p className="status-title">
            {busy ? "جاري التسجيل..." : result?.message ?? "بانتظار مسح QR"}
          </p>
          {result?.employee && <h2>{result.employee.name}</h2>}
          {result?.record && (
            <div className="scan-details">
              <span>{result.record.localDate}</span>
              <span>{result.record.localTime}</span>
              <span>{result.duplicate ? "مسجل مسبقاً اليوم" : formatStatus(result)}</span>
            </div>
          )}
        </div>
      <div className="scanner-actions">
          <a className="btn btn-secondary" href="/">دخول الإدارة</a>
          <span>يعمل مع ملفات الموظفين والرواتب داخل لوحة التحكم</span>
        </div>
      </section>
    </main>
  );
}
