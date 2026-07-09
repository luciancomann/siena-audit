import type { Metadata } from "next";
import { SvgSprite } from "@/components/SvgSprite";
import { Runtimes } from "@/components/runtime/Runtimes";
import { MountedRuntime } from "@/components/runtime/MountedRuntime";
import "./styles/fonts.css";
import "./styles/base.css";

export const metadata: Metadata = {
  title: "Empathic AI Agents for commerce | Siena AI",
  description:
    "Experience AI agents that combine empathy with automation for commerce. Provide personalized shopper support. Schedule a demo today!",
  icons: {
    // the large Siena mark provided for this playground (180x180 PNG)
    icon: [{ url: "/assets/images/siena-favicon-large.png", type: "image/png" }],
    apple: [{ url: "/assets/images/siena-favicon-large.png" }],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <SvgSprite />
        {children}
        <Runtimes />
        <MountedRuntime />
      </body>
    </html>
  );
}
