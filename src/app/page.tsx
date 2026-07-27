import Link from "next/link";

import { SiteFrame } from "../components/site-frame";

export default function Home() {
  return (
    <SiteFrame currentPage="home" landing variant="public">
      <section className="hero-section" aria-labelledby="hero-heading">
        <div className="hero-copy">
          <p className="eyebrow">CipherQuery · Private data intelligence</p>
          <h1 id="hero-heading" className="hero-title">
            Encrypted data evaluation.
            <br />
            <span>Without exposing the data.</span>
          </h1>
          <p className="hero-lede">
            Ask questions about private data. Sellers keep control while 0G
            evaluates an encrypted sample inside protected compute.
          </p>
          <div className="hero-actions">
            <Link className="button-primary" href="/new">
              Create an evaluation
            </Link>
          </div>
          <ul className="trust-line" aria-label="Product assurances">
            <li>Encrypted in transit</li>
            <li>Memory-only handling</li>
            <li>Raw rows never shared</li>
          </ul>
        </div>

        <ProductPreview />
      </section>
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
          Does this private news feed identify market-moving events before BTC
          reacts?
        </h2>
        <div className="preview-score-row">
          <div>
            <strong>80</strong>
            <span>/100</span>
          </div>
          <p>
            Requirement met
            <small>High confidence</small>
          </p>
        </div>
        <p className="preview-explanation">
          8 of 10 timestamped events appear before the related price move. Two
          arrive only after the market has already reacted.
        </p>
      </div>
      <div className="preview-footer">
        <span>Protected submission.</span>
        <span>No raw rows exposed.</span>
      </div>
    </aside>
  );
}
