import "./globals.css";
import type { Metadata } from "next";
import { LocaleProvider } from "../lib/i18n";

export const metadata: Metadata = {
  title: "Scan Krwalo",
  description: "Post. Grab. Complete. Earn."
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <LocaleProvider>{children}</LocaleProvider>
      </body>
    </html>
  );
}
