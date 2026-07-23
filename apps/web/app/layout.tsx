import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Scan Krwalo",
  description: "Post. Grab. Complete. Earn."
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        {children}
      </body>
    </html>
  );
}
