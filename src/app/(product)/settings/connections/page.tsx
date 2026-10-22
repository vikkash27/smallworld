import type { Metadata } from "next";
import { ConnectionsScreen } from "@/components/connections/ConnectionsScreen";
export const metadata: Metadata = {
  title: "Connect your communities | Small World",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};
export default function ConnectionsPage() {
  return <ConnectionsScreen />;
}
