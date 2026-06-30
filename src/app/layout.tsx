import type { Metadata, Viewport } from "next";
import VisualEffects from "@/components/effects/VisualEffects";
import "./globals.css";

export const metadata: Metadata = {
  title: "الطاقم TheCrew — إدارة الحضور والرواتب",
  description: "نظام احترافي لإدارة حضور الموظفين، الرواتب، الخصومات، والتقارير.",
  icons: {
    icon: "/favicon.png",
    apple: "/logo.png",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#050711"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ar" dir="rtl">
      <body>
        <VisualEffects />
        {children}
      </body>
    </html>
  );
}
