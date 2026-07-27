import type { Metadata } from "next";
import Link from "next/link";

import { EvaluationBuilder } from "../../components/evaluation-builder";
import { SiteFrame } from "../../components/site-frame";
import { WorkflowProgress } from "../../components/workflow-progress";

export const metadata: Metadata = {
  title: "Create a secure evaluation",
  description:
    "Create protected seller and buyer links for a private, TEE-verified dataset evaluation.",
};

export default function NewEvaluationPage() {
  return (
    <SiteFrame currentPage="new" variant="public">
      <div className="creation-page">
        <header className="creation-intro">
          <Link className="back-link" href="/">
            <span aria-hidden="true">←</span> Home
          </Link>
          <p className="eyebrow">Buyer setup</p>
          <h1>Create a private evaluation.</h1>
          <p>
            Write your questions. CipherQuery creates one private link for the
            seller and one for your results.
          </p>
          <WorkflowProgress current="questions" />
        </header>

        <EvaluationBuilder />
      </div>
    </SiteFrame>
  );
}
