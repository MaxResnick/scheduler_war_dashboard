import type { Metadata } from "next";
import Link from "next/link";
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
        <div className="fixed top-4 left-6 z-50">
          <Link
            href="/"
            className="flex flex-col items-start leading-none text-left group"
          >
            <span className="text-[10px] font-bold tracking-[0.2em] uppercase text-slate-500 group-hover:text-slate-300 transition-colors">
              SOLANA
            </span>
            <span className="text-[10px] font-bold tracking-[0.2em] uppercase text-slate-500 group-hover:text-slate-300 transition-colors">
              SCHEDULER
            </span>
            <span className="text-[10px] font-bold tracking-[0.2em] uppercase text-slate-500 group-hover:text-slate-300 transition-colors">
              WAR
            </span>
          </Link>
        </div>
        <main className="min-h-screen">
          {children}
        </main>
      </body>
    </html>
  );
}
