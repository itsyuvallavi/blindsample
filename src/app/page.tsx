import Link from "next/link";

import { SiteFrame } from "../components/site-frame";

export default function Home() {
  return (
    <SiteFrame variant="public">
      <div className="marketing-page">
        <section className="hero-section">
          <div className="hero-copy">
            <p className="eyebrow">Secure private data evaluation</p>
            <h1 className="hero-title">
              Verify private data.
              <br />
              <span>Without exposing it.</span>
            </h1>
            <p className="hero-lede">
              BlindSample gives buyers useful answers while sellers keep
              control of their data. The sample travels over encrypted
              transport, is handled only in memory, and is evaluated inside
              0G Private Computer.
            </p>
            <div className="hero-actions">
              <Link className="button-primary" href="/new">
                Create an evaluation
              </Link>
              <Link className="text-link" href="/#how-it-works">
                See how it works <span aria-hidden="true">↓</span>
              </Link>
            </div>
            <ul className="trust-line" aria-label="Product assurances">
              <li>Encrypted in transit</li>
              <li>TEE-protected compute</li>
              <li>Raw rows never shared</li>
            </ul>
          </div>

          <ProductPreview />
        </section>

        <section
          className="content-section"
          id="how-it-works"
          aria-labelledby="how-heading"
        >
          <div className="section-heading">
            <p className="eyebrow">
              One protected path, two private roles
            </p>
            <h2 id="how-heading">
              From encrypted submission to verified answer.
            </h2>
            <p>
              The buyer learns what matters. The seller keeps the underlying
              data private.
            </p>
          </div>

          <ol className="process-grid">
            <li>
              <span>01</span>
              <h3>Ask plain questions</h3>
              <p>
                The buyer names the evaluation and writes exactly what they
                need to learn about the data.
              </p>
            </li>
            <li>
              <span>02</span>
              <h3>Submit through a private link</h3>
              <p>
                The seller&apos;s CSV travels over TLS-encrypted transport.
                The buyer keeps a separate private results link.
              </p>
            </li>
            <li>
              <span>03</span>
              <h3>Evaluate in protected compute</h3>
              <p>
                The sample and all questions go through one 0G Private
                Computer request. Results publish only after TEE verification.
              </p>
            </li>
          </ol>
        </section>

        <section
          className="proof-section"
          id="privacy"
          aria-labelledby="privacy-heading"
        >
          <div className="proof-copy">
            <p className="eyebrow">Protection at every boundary</p>
            <h2 id="privacy-heading">
              The sample stays protected from upload to answer.
            </h2>
            <p>
              BlindSample encrypts transport, limits raw-data handling to
              server memory, and reveals only safe question-level results.
              The buyer never receives the CSV.
            </p>
            <Link className="text-link" href="/docs#privacy">
              Read the privacy boundary <span aria-hidden="true">→</span>
            </Link>
          </div>

          <dl className="proof-list">
            <div>
              <dt>Encrypted transport</dt>
              <dd>
                TLS protects the seller&apos;s submission and buyer&apos;s
                questions while they travel.
              </dd>
            </div>
            <div>
              <dt>Memory-only handling</dt>
              <dd>
                The parsed CSV exists only for the evaluation request. It is
                never written to Supabase.
              </dd>
            </div>
            <div>
              <dt>TEE-verified compute</dt>
              <dd>
                One 0G private request handles the complete sample and every
                question. A positive TEE trace is required before publication.
              </dd>
            </div>
          </dl>
        </section>

        <section className="use-case-section" aria-labelledby="use-case-heading">
          <div className="section-heading">
            <p className="eyebrow">Useful when trust is expensive</p>
            <h2 id="use-case-heading">
              Test quality before the data changes hands.
            </h2>
          </div>
          <ul className="use-case-list">
            <li>Market and pricing feeds</li>
            <li>Business intelligence exports</li>
            <li>News and event signals</li>
            <li>Sequential data quality</li>
          </ul>
        </section>

        <section className="closing-section">
          <div>
            <p className="eyebrow">Protected from upload to result</p>
            <h2>Keep the rows private. Share only the answer.</h2>
          </div>
          <div className="closing-actions">
            <Link className="button-primary" href="/new">
              Create an evaluation
            </Link>
            <Link className="button-secondary" href="/docs">
              Read the docs
            </Link>
          </div>
        </section>
      </div>
    </SiteFrame>
  );
}

function ProductPreview() {
  return (
    <aside className="product-preview" aria-label="Illustrative product result">
      <div className="preview-topline">
        <span>Illustrative result</span>
        <span className="preview-status">
          <i aria-hidden="true" /> TEE verified
        </span>
      </div>
      <div className="preview-body">
        <p className="preview-label">Question 01 · Evaluated by 0G</p>
        <h2>
          Are the BTC price records complete and sequential?
        </h2>
        <div className="preview-score-row">
          <div>
            <strong>92</strong>
            <span>/100</span>
          </div>
          <p>High confidence</p>
        </div>
        <div className="preview-meter" aria-hidden="true">
          <span />
        </div>
        <p className="preview-explanation">
          The submitted sample contains the required OHLCV fields and follows
          the expected time sequence, with one small interval inconsistency.
        </p>
      </div>
      <div className="preview-footer">
        <span>Protected submission.</span>
        <span>No raw rows exposed.</span>
      </div>
    </aside>
  );
}
