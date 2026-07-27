import Link from "next/link";

import { SiteFrame } from "../components/site-frame";

export default function Home() {
  return (
    <SiteFrame currentPage="home" landing variant="public">
      <section className="hero-section" aria-labelledby="hero-heading">
        <div className="hero-copy">
          <p className="eyebrow">Encrypted dataset evaluation</p>
          <h1 id="hero-heading" className="hero-title">
            Encrypted answers for data you cannot share.
          </h1>
          <p className="hero-lede">
            Buyers ask what a dataset can prove. Sellers submit privately.
            Only verified answers come back.
          </p>
          <div className="hero-actions">
            <Link className="button-primary" href="/new">
              Create an evaluation
            </Link>
            <Link className="text-link" href="/docs">
              See how privacy works
            </Link>
          </div>
          <ul className="trust-line" aria-label="Product assurances">
            <li>Seller keeps control</li>
            <li>Raw rows stay private</li>
            <li>TEE verified</li>
          </ul>
        </div>

        <PrivacyBoundary />
      </section>
    </SiteFrame>
  );
}

function PrivacyBoundary() {
  return (
    <aside className="privacy-demo" aria-label="How private evaluation works">
      <div className="privacy-demo__topline">
        <span>Example evaluation</span>
        <span>
          <i aria-hidden="true" /> Protected by 0G
        </span>
      </div>

      <div className="privacy-demo__question">
        <p>Buyer asks</p>
        <h2>
          Does this private news feed identify market-moving events before BTC
          reacts?
        </h2>
      </div>

      <div className="privacy-demo__flow">
        <div className="sealed-input">
          <span>Seller submits</span>
          <strong>news_feed.csv</strong>
          <small>Raw rows sealed</small>
        </div>

        <div className="privacy-boundary" aria-label="Encrypted private boundary">
          <span aria-hidden="true">↗</span>
          <strong>Private boundary</strong>
          <small>Encrypted · memory only</small>
        </div>

        <div className="verified-output">
          <span>Buyer receives</span>
          <div>
            <strong>80</strong>
            <small>/100</small>
          </div>
          <p>Requirement mostly met</p>
        </div>
      </div>

      <div className="privacy-demo__footer">
        <span>One answer per question</span>
        <strong>0 raw rows exposed</strong>
      </div>
    </aside>
  );
}
