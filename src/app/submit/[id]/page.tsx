import type { Metadata } from "next";

import { SellerSubmission } from "../../../components/seller-submission";
import { SiteFrame } from "../../../components/site-frame";

export const metadata: Metadata = {
  title: "Submit a private dataset sample",
  description:
    "Review the buyer's questions and run one private 0G evaluation without storing the dataset sample.",
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
    <SiteFrame compact role="Seller submission" variant="task">
      <SellerSubmission evaluationId={id} />
    </SiteFrame>
  );
}
