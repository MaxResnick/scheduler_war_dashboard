import type { Metadata } from "next";
import Link from "next/link";
import ThemeToggle from "@/components/theme-toggle";
import "@/app/globals.css";

export const metadata: Metadata = {
  title: "Solana Scheduler War Dashboard",
  description:
    "Operational dashboard for monitoring Solana scheduler activity and upcoming scheduler war metrics."
};

const themeScript = `
(function(){
  var t = localStorage.getItem('theme');
  var d = t === 'dark' || (!t && matchMedia('(prefers-color-scheme: dark)').matches);
  if (d) document.documentElement.classList.add('dark');
})();
`;

export default function RootLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="font-sans">
        <div className="fixed top-4 left-6 z-50">
          <Link
            href="/"
            className="flex flex-col items-start leading-none text-left group"
          >
            <span className="text-[10px] font-bold tracking-[0.2em] uppercase text-anza-green-muted group-hover:text-anza-green transition-colors">
              SOLANA
            </span>
            <span className="text-[10px] font-bold tracking-[0.2em] uppercase text-anza-green-muted group-hover:text-anza-green transition-colors">
              SCHEDULER
            </span>
            <span className="text-[10px] font-bold tracking-[0.2em] uppercase text-anza-green-muted group-hover:text-anza-green transition-colors">
              WAR
            </span>
          </Link>
        </div>
        <div className="fixed top-4 right-6 z-50">
          <ThemeToggle />
        </div>
        <main className="min-h-screen">
          {children}
        </main>
      </body>
    </html>
  );
}
