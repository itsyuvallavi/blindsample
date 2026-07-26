import { EvaluationBuilder } from "../components/evaluation-builder";
import { SiteFrame } from "../components/site-frame";

export default function Home() {
  return (
    <SiteFrame role="Buyer setup">
      <section className="home-workbench">
        <div className="home-copy">
          <p className="eyebrow">
            <span aria-hidden="true" /> Private dataset evaluation
          </p>
          <h1 className="hero-title">
            Know if the data is worth it.
          </h1>
          <p className="hero-lede">
            Ask what matters. The seller shares a private sample. You get a
            clear, auditable score without seeing their rows.
          </p>
          <div className="trust-line" aria-label="Product assurances">
            <span>Private by default</span>
            <span>Verified with 0G</span>
            <span>No overall score</span>
          </div>
        </div>

        <EvaluationBuilder />
      </section>

      <ol className="simple-steps" aria-label="How BlindSample works">
        <li>
          <span>01</span>
          <p>Define</p>
        </li>
        <li>
          <span>02</span>
          <p>Share</p>
        </li>
        <li>
          <span>03</span>
          <p>Evaluate</p>
        </li>
        <li>
          <span>04</span>
          <p>Results</p>
        </li>
      </ol>
    </SiteFrame>
  );
}
