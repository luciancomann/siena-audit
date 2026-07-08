import type { Metadata } from "next";
import { SvgSprite } from "@/components/SvgSprite";
import { Runtimes } from "@/components/runtime/Runtimes";
import "./styles/fonts.css";
import "./styles/base.css";

export const metadata: Metadata = {
  title: "Empathic AI Agents for commerce | Siena AI",
  description:
    "Experience AI agents that combine empathy with automation for commerce. Provide personalized shopper support. Schedule a demo today!",
  icons: {
    icon: [
      { url: "/assets/images/kL7LC48C9HNuGNWImObgKkOgJY.png", media: "(prefers-color-scheme: light)" },
      { url: "/assets/images/AU3mKAHO32N07sUbamHcsejzfBM.png", media: "(prefers-color-scheme: dark)" },
    ],
    apple: [{ url: "/assets/images/Of7MbFxej7RYhdnkqPyjFhmirRw.png" }],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <SvgSprite />
        {children}
        <Runtimes />
      </body>
    </html>
  );
}
