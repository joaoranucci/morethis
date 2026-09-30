import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "MoreThis | SaaS B2B",
  description: "Espaço de desenvolvimento do MoreThis.",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="pt-BR"><body>{children}</body></html>;
}
