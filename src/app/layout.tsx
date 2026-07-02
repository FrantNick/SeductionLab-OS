import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Seduction Lab OS",
    template: "%s · Seduction Lab OS",
  },
  description:
    "Marketing experimentation and affiliate attribution — campaigns, threads, clicks, revenue.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen font-sans">{children}</body>
    </html>
  );
}
