import type { Metadata } from "next";

import { BuyerResults } from "../../../components/buyer-results";
import { SiteFrame } from "../../../components/site-frame";

export const metadata: Metadata = {
  title: "Secured private dataset scores | BlindSample",
  description:
    "View secured, question-level dataset suitability scores from 0G private compute.",
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
    <SiteFrame compact>
      <BuyerResults evaluationId={id} />
    </SiteFrame>
  );
}
