import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AgentRight — Governance for AI Agents",
  description:
    "Monitor what your agents do. Prove they're safe. Manage the fleet. Open-source trust scoring for AI agents.",
  keywords: [
    "AI agents",
    "governance",
    "trust",
    "compliance",
    "NIST",
    "agent identity",
    "agent security",
  ],
  openGraph: {
    title: "AgentRight — Governance for AI Agents",
    description:
      "Monitor what your agents do. Prove they're safe. Manage the fleet.",
    url: "https://agentright.vercel.app",
    siteName: "AgentRight",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "AgentRight",
    description:
      "Open-source governance platform for AI agents. Trust scoring across 5 dimensions.",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
