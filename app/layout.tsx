import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "Banyan · Workflow",
  description: "A workflow board for moving good work forward.",
  robots: { index: false, follow: false },
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
