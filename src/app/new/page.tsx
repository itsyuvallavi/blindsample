import type { Metadata } from "next";
import Link from "next/link";

import { EvaluationBuilder } from "../../components/evaluation-builder";
import { SiteFrame } from "../../components/site-frame";

export const metadata: Metadata = {
  title: "Create an evaluation",
  description:
    "Create private seller and buyer links from plain-language dataset questions.",
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
          <h1>Create a private evaluation.</h1>
          <p>
            Write the questions that matter to your purchase. BlindSample will
            create one link for the seller and one private results link for
            you.
          </p>
          <ul className="creation-promises">
            <li>Questions stay plain text</li>
            <li>No 0G tokens spent yet</li>
            <li>Draft saved in this browser</li>
          </ul>
        </header>

        <EvaluationBuilder />
      </div>
    </SiteFrame>
  );
}
