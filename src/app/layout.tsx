import "./globals.css";
import { GeistMono } from "geist/font/mono";
import { GeistSans } from "geist/font/sans";
import type { ReactNode } from "react";
import { AppShell } from "@/components/AppShell";
import { AppStateProvider } from "@/components/AppState";
import { RailInspectorProvider } from "@/components/RailInspector";

export const metadata = {
  title: "FieldGrant: programmatic tranche liquidity for global philanthropy",
  description: "Sandbox prototype of grant tranche release logic: AI extracts evidence, deterministic rules verify it, PayPal Payouts release the tranche.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable} scroll-smooth`}>
      <body className="min-h-screen">
        <AppStateProvider>
          <RailInspectorProvider><AppShell>{children}</AppShell></RailInspectorProvider>
        </AppStateProvider>
      </body>
    </html>
  );
}
