import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://blindsample.vercel.app"),
  title: {
    default: "CipherQuery | Encrypted data evaluation",
    template: "%s | CipherQuery",
  },
  description:
    "Secure dataset evaluation with encrypted transport, memory-only handling, and TEE-verified 0G Private Computer.",
  openGraph: {
    description:
      "Evaluate a seller's private CSV through encrypted transport and TEE-verified 0G compute without exposing the raw rows.",
    title: "CipherQuery | Encrypted data evaluation",
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
