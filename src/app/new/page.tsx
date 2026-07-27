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
            <span aria-hidden="true">←</span> Back to overview
          </Link>
          <p className="eyebrow">Private buyer setup</p>
          <h1>Ask what the data must prove.</h1>
          <p>
            Name the evaluation and write your questions. CipherQuery creates
            separate private links for the seller and your results.
          </p>
          <WorkflowProgress current="questions" />
        </header>

        <EvaluationBuilder />
      </div>
    </SiteFrame>
  );
}
