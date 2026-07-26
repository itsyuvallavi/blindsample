import type { Metadata } from "next";

import { BuyerResults } from "../../../components/buyer-results";
import { SiteFrame } from "../../../components/site-frame";

export const metadata: Metadata = {
  title: "Private dataset results | BlindSample",
  description:
    "View one verified 0G result for each buyer question.",
  robots: {
    follow: false,
    index: false,
  },
};

export default async function ResultsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <SiteFrame compact role="Private buyer results">
      <BuyerResults evaluationId={id} />
    </SiteFrame>
  );
}
