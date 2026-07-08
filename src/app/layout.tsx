import type { Metadata } from "next";
import { ToastProvider } from "@/components/toast";
import { ThemeProvider } from "@/components/theme";
import "./globals.css";

// applied before paint so a persisted dark theme never flashes light
const themeInit = `(function(){try{var t=localStorage.getItem("sl-theme");if(t==="dark"||(!t&&window.matchMedia("(prefers-color-scheme: dark)").matches)){document.documentElement.classList.add("dark")}}catch(e){}})()`;

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
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen font-sans">
        <script dangerouslySetInnerHTML={{ __html: themeInit }} />
        <ThemeProvider>
          <ToastProvider>{children}</ToastProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
