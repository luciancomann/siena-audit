import type { Metadata } from "next";
import { Shell } from "./_components/Shell";
// Growth OS imports no DS components, so pull the token sheet explicitly —
// every gos-* rule is written in --sds-* variables.
import "@siena/design-system/styles.css";
import "./growth-os.css";

export const metadata: Metadata = {
  title: "Growth OS · Siena",
  description: "Internal growth operations. Runs inside Siena OS.",
  robots: { index: false },
};

export default function GrowthOsLayout({ children }: { children: React.ReactNode }) {
  return <Shell>{children}</Shell>;
}
