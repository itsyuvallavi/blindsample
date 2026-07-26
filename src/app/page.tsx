import Link from "next/link";

import { SiteFrame } from "../components/site-frame";

export default function Home() {
  return (
    <SiteFrame variant="public">
      <div className="marketing-page">
        <section className="hero-section">
          <div className="hero-copy">
            <p className="eyebrow">Private data due diligence</p>
            <h1 className="hero-title">
              Inspect the data.
              <br />
              <span>Not the dataset.</span>
            </h1>
            <p className="hero-lede">
              Ask what matters before you buy. A seller submits a private CSV
              sample, and 0G returns a separate, verified answer for every
              question without revealing the rows.
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
              <li>One private 0G request</li>
              <li>TEE verification required</li>
              <li>No local scoring</li>
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
              One evaluation, two private roles
            </p>
            <h2 id="how-heading">A clear path from question to proof.</h2>
            <p>
              BlindSample keeps the buyer&apos;s decision simple and the
              seller&apos;s data private.
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
              <h3>Share separate links</h3>
              <p>
                The seller gets a submission link. The buyer keeps a private
                results link.
              </p>
            </li>
            <li>
              <span>03</span>
              <h3>Receive verified answers</h3>
              <p>
                The sample and all questions go through one private 0G
                request. No local fallback can publish a score.
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
            <p className="eyebrow">Privacy with evidence</p>
            <h2 id="privacy-heading">
              Private is a system property, not a promise.
            </h2>
            <p>
              BlindSample limits what moves, what persists, and what can be
              shown to the buyer. The result is useful without becoming a
              backdoor to the seller&apos;s dataset.
            </p>
            <Link className="text-link" href="/docs#privacy">
              Read the privacy boundary <span aria-hidden="true">→</span>
            </Link>
          </div>

          <dl className="proof-list">
            <div>
              <dt>In memory only</dt>
              <dd>
                The parsed CSV exists only for the evaluation request and is
                not written to Supabase.
              </dd>
            </div>
            <div>
              <dt>One atomic evaluation</dt>
              <dd>
                All buyer questions and the complete bounded sample travel
                together to 0G Private Computer.
              </dd>
            </div>
            <div>
              <dt>Verified before publish</dt>
              <dd>
                BlindSample requires a complete response and a positive TEE
                trace before showing any score.
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
            <p className="eyebrow">Start with the questions</p>
            <h2>Know what the sample can prove.</h2>
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
        <span>One question. One score.</span>
        <span>No raw rows exposed.</span>
      </div>
    </aside>
  );
}
