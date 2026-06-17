import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://proxyflow.ai"),
  title: {
    default: "ProxyFlow AI — Bulletproof AI Infrastructure. Engineered to Scale.",
    template: "%s · ProxyFlow AI",
  },
  description:
    "An autonomous orchestration firewall deployed beneath your model layer. Router, compressor, loop-breaker — global Edge scale, zero latency, AI bankruptcy insurance. Eliminate LLM cost-bleeding and API token waste.",
  keywords: [
    "AI FinOps",
    "LLM proxy",
    "API cost optimization",
    "token compression",
    "agent loop breaker",
    "Edge AI infrastructure",
    "OpenAI proxy",
    "Anthropic proxy",
  ],
  authors: [{ name: "ProxyFlow AI" }],
  creator: "ProxyFlow AI",
  openGraph: {
    type: "website",
    title: "ProxyFlow AI — Bulletproof AI Infrastructure. Engineered to Scale.",
    description:
      "We deploy an autonomous orchestration firewall directly beneath your model layer. Router, compressor, loop-breaker. So your infrastructure actually survives production billing.",
    siteName: "ProxyFlow AI",
  },
  twitter: {
    card: "summary_large_image",
    title: "ProxyFlow AI — Bulletproof AI Infrastructure. Engineered to Scale.",
    description:
      "Autonomous orchestration firewall beneath your model layer. Router, compressor, loop-breaker. Zero latency. Global Edge scale.",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export const viewport: Viewport = {
  themeColor: "#000000",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-void text-white font-sans tracking-brutal antialiased">
        {children}
      </body>
    </html>
  );
}
