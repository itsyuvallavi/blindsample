import type { Metadata } from "next";
import Link from "next/link";

import { EvaluationBuilder } from "../../components/evaluation-builder";
import { SiteFrame } from "../../components/site-frame";

export const metadata: Metadata = {
  title: "Create a secure evaluation",
  description:
    "Create protected seller and buyer links for a private, TEE-verified dataset evaluation.",
};

export default function NewEvaluationPage() {
  return (
    <SiteFrame variant="public">
      <div className="creation-page">
        <header className="creation-intro">
          <Link className="back-link" href="/">
            <span aria-hidden="true">←</span> Back to overview
          </Link>
          <p className="eyebrow">Buyer setup</p>
          <h1>Create a secure data evaluation.</h1>
          <p>
            Ask what matters to your purchase. The seller submits through
            encrypted transport, 0G evaluates the sample privately, and you
            receive only verified answers.
          </p>
          <ul className="creation-promises">
            <li>Encrypted seller submission</li>
            <li>0G TEE-verified compute</li>
            <li>No 0G tokens spent yet</li>
          </ul>
        </header>

        <EvaluationBuilder />
      </div>
    </SiteFrame>
  );
}
