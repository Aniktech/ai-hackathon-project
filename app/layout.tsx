import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Store Coach | Retail Performance Intelligence",
  description:
    "A retail performance intelligence platform for more bills, bigger baskets, and more repeat customers.",
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
