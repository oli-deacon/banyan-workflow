import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "Banyan · Workflow",
  description: "A local workspace for moving good work forward.",
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
