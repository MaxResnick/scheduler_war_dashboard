import type { Metadata } from "next";
import "@/app/globals.css";

export const metadata: Metadata = {
  title: "Solana Scheduler War Dashboard",
  description:
    "Operational dashboard for monitoring Solana scheduler activity and upcoming scheduler war metrics."
};

export default function RootLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="font-sans">
        <main className="min-h-screen">
          {children}
        </main>
      </body>
    </html>
  );
}
