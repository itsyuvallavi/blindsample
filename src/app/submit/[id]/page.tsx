import type { Metadata } from "next";

import { SellerSubmission } from "../../../components/seller-submission";
import { SiteFrame } from "../../../components/site-frame";

export const metadata: Metadata = {
  title: "Submit a secured private sample | BlindSample",
  description:
    "Review the buyer's questions and send a TLS-encrypted CSV sample into 0G private compute.",
  robots: {
    follow: false,
    index: false,
  },
};

export default async function SubmitPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <SiteFrame compact role="Seller submission">
      <SellerSubmission evaluationId={id} />
    </SiteFrame>
  );
}
