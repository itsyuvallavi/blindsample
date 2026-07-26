import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "BlindSample",
  description:
    "Private dataset evaluation with one atomic, TEE-verified 0G request.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
