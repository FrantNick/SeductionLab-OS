import type { Metadata } from "next";
import { ToastProvider } from "@/components/toast";
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
    <html lang="en">
      <body className="min-h-screen font-sans">
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
