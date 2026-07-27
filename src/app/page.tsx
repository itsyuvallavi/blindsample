import Link from "next/link";

import { PrivacyScrollStory } from "../components/home/privacy-scroll-story";
import { SmoothScroll } from "../components/home/smooth-scroll";
import { VerifiedResultStage } from "../components/home/verified-result-stage";
import { SiteFrame } from "../components/site-frame";

export default function Home() {
  return (
    <SiteFrame currentPage="home" landing variant="public">
      <SmoothScroll />
      <div className="home-chapter home-chapter--hero">
        <section
          className="hero-section home-hero"
          aria-labelledby="hero-heading"
        >
          <div className="hero-copy">
            <p className="home-hero__eyebrow">Encrypted dataset evaluation</p>
            <h1
              id="hero-heading"
              className="hero-title home-hero__title"
              aria-label="Encrypted answers for data you cannot share."
            >
              <span>Encrypted answers</span>
              <span>for data you</span>
              <span>cannot share.</span>
            </h1>
            <p className="hero-lede">
              Buyers ask what a dataset can prove. Sellers submit privately.
              Only verified answers come back.
            </p>
            <p className="hero-proof">
              Encrypted in transit · memory-only processing · TEE verified
            </p>
          </div>

          <div className="hero-showcase">
            <PrivacyBoundary />
            <div className="hero-showcase__action">
              <Link className="button-primary" href="/new">
                Create an evaluation
              </Link>
            </div>
          </div>
        </section>
      </div>

      <PrivacyScrollStory />

      <div className="home-chapter">
        <VerifiedResultStage />
      </div>
    </SiteFrame>
  );
}

function PrivacyBoundary() {
  return (
    <aside className="privacy-demo" aria-label="How private evaluation works">
      <div className="privacy-demo__topline">
        <span>Private evaluation, illustrative</span>
        <span>
          <i aria-hidden="true" /> TEE verified
        </span>
      </div>

      <div className="privacy-demo__question">
        <p>Buyer asks</p>
        <h2>
          Does this private news feed identify market-moving events before BTC
          reacts?
        </h2>
      </div>

      <div className="privacy-demo__answer">
        <div className="privacy-route" aria-label="Encrypted evaluation path">
          <span>Seller sample</span>
          <i aria-hidden="true">→</i>
          <strong>0G private compute</strong>
          <i aria-hidden="true">→</i>
          <span>Verified answer</span>
          <span className="privacy-route__rail" aria-hidden="true" />
        </div>
        <div className="verified-output">
          <div>
            <strong>80</strong>
            <small>/100</small>
          </div>
          <p>Requirement mostly met</p>
        </div>
      </div>

      <div className="privacy-demo__footer">
        <span>Encrypted · memory only</span>
        <strong>0 raw rows exposed</strong>
      </div>
    </aside>
  );
}
