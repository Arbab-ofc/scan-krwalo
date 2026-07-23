import "./globals.css";
import type { Metadata } from "next";
import Script from "next/script";

export const metadata: Metadata = {
  title: "Scan Krwalo",
  description: "Post. Grab. Complete. Earn."
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <Script id="onesignal-deferred" strategy="beforeInteractive">
          {`window.OneSignalDeferred = window.OneSignalDeferred || [];`}
        </Script>
        <Script src="https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js" strategy="afterInteractive" />
        {children}
      </body>
    </html>
  );
}
