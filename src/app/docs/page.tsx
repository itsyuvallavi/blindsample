import type { Metadata } from "next";
import Link from "next/link";

import { SiteFrame } from "../../components/site-frame";

export const metadata: Metadata = {
  title: "Documentation",
  description:
    "How CipherQuery protects a private structured dataset with encrypted transport, memory-only handling, and TEE-verified 0G compute.",
};

const sections = [
  ["overview", "Overview"],
  ["workflow", "Workflow"],
  ["scoring", "Scoring"],
  ["privacy", "Privacy"],
  ["zero-g", "0G and TEE"],
] as const;

export default function DocsPage() {
  return (
    <SiteFrame currentPage="docs" variant="public">
      <div className="docs-page">
        <aside className="docs-sidebar">
          <p>Documentation</p>
          <nav aria-label="Documentation sections">
            {sections.map(([id, label]) => (
              <Link key={id} href={`#${id}`}>
                {label}
              </Link>
            ))}
          </nav>
        </aside>

        <article className="docs-content">
          <header className="docs-hero" id="overview">
            <p className="eyebrow">CipherQuery docs</p>
            <h1>How private evaluation works.</h1>
            <p>
              A seller submits a bounded sample. 0G evaluates the buyer&apos;s
              questions inside protected compute. Only verified answers leave.
            </p>
            <ol className="docs-overview" aria-label="Workflow summary">
              <li><strong>Ask</strong><span>The buyer writes plain-language questions.</span></li>
              <li><strong>Submit</strong><span>The seller uploads through an encrypted link.</span></li>
              <li><strong>Verify</strong><span>0G returns one verified result per question.</span></li>
            </ol>
          </header>

          <section className="docs-section" id="workflow">
            <div>
              <h2>Workflow</h2>
              <ol className="docs-steps">
                <li>
                  <strong>Ask and separate access.</strong>
                  <span>
                    Add a name and 1-20 plain-language questions. CipherQuery
                    creates separate seller and buyer links. Questions do not
                    need to reference columns or scoring types.
                  </span>
                </li>
                <li>
                  <strong>Submit a bounded sample.</strong>
                  <span>
                    TLS protects a CSV, JSONL, NDJSON, or flat Parquet sample
                    with 1-50 records, up to 20 columns, and a maximum size of
                    200 KB. A free browser check runs
                    before any paid request.
                  </span>
                </li>
                <li>
                  <strong>Evaluate and verify.</strong>
                  <span>
                    The complete bounded sample and every original question
                    are sent in one private 0G request. Every question receives
                    its own score or a clear unable state.
                  </span>
                </li>
              </ol>
            </div>
          </section>

          <section className="docs-section" id="scoring">
            <div>
              <h2>What a score means</h2>
              <p>
                A score answers one buyer question against only the submitted
                sample. Zero means the sample did not meet that question&apos;s
                requirement. One hundred means it fully met the requirement.
                The result includes a short explanation and confidence level.
              </p>
              <div className="docs-callout">
                <strong>No overall score.</strong>
                <p>
                  Different questions can test different qualities. Combining
                  them would hide useful distinctions and create false
                  precision.
                </p>
              </div>
              <p>
                If 0G cannot answer a question safely from the sample,
                CipherQuery publishes <em>Unable</em> instead of inventing a
                number. If the full verified result set is unavailable, no
                scores are published.
              </p>
            </div>
          </section>

          <section className="docs-section" id="privacy">
            <div>
              <h2>Privacy boundary</h2>
              <p>
                TLS encrypts the sample in transit. The sample, the full
                private prompt, and the raw 0G response then exist only in
                server memory for the duration of the request. They are not
                written to Supabase, browser storage, analytics, or
                application logs.
              </p>
              <p>
                The buyer receives the original questions, question-level
                result summaries, score or unable state, confidence, and safe
                verification metadata. The buyer does not receive sample size,
                row references, values, or aggregate counts.
              </p>
              <div className="docs-callout docs-callout--warning">
                <strong>A sample is still a sample.</strong>
                <p>
                  Results describe only the submitted records. They do not
                  prove that the seller&apos;s full dataset has the same
                  quality.
                </p>
              </div>
            </div>
          </section>

          <section className="docs-section" id="zero-g">
            <div>
              <h2>0G Router and TEE verification</h2>
              <p>
                CipherQuery sends one OpenAI-compatible request to the 0G
                Router using private trust mode. The Router selects the
                configured private-capable model and returns the inference
                response with execution metadata.
              </p>
              <dl className="docs-definitions">
                <div>
                  <dt>0G Private Computer</dt>
                  <dd>
                    Runs the model evaluation in protected compute so the
                    seller&apos;s sample is not exposed to the buyer.
                  </dd>
                </div>
                <div>
                  <dt>TEE verification</dt>
                  <dd>
                    Confirms that 0G reports protected execution for the
                    request. It proves the execution path, not that every model
                    judgment is correct.
                  </dd>
                </div>
                <div>
                  <dt>Fail closed</dt>
                  <dd>
                    A timeout, authentication failure, missing TEE trace,
                    invalid JSON, unsafe evidence, or partial result set
                    publishes no scores.
                  </dd>
                </div>
              </dl>
            </div>
          </section>

        </article>
      </div>
    </SiteFrame>
  );
}
