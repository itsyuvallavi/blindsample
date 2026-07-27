import type { Metadata } from "next";

import { EncryptedDemo } from "../../components/encrypted-demo";

export const metadata: Metadata = {
  title: "Encrypted computation chamber — design demo",
  description:
    "An interactive CipherQuery concept showing how private data becomes a verified answer without exposing raw rows.",
};

export default function DemoPage() {
  return <EncryptedDemo />;
}
