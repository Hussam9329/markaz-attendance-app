import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Markaz HR Pro — حضور ورواتب الموظفين",
  description: "برنامج احترافي لإدارة حضور الموظفين عبر QR، الغياب، التأخير، الرواتب، الخصومات، والتقارير."
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#0f172a"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ar" dir="rtl">
      <body>{children}</body>
    </html>
  );
}
