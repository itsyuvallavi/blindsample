import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://blindsample.vercel.app"),
  title: {
    default: "BlindSample | Verify private data before you buy it",
    template: "%s | BlindSample",
  },
  description:
    "Ask questions about a seller's private CSV and receive question-level, TEE-verified answers from 0G without seeing the raw rows.",
  openGraph: {
    description:
      "Question-level answers about private data, evaluated through 0G Private Computer without exposing the seller's rows.",
    title: "BlindSample | Verify private data before you buy it",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
