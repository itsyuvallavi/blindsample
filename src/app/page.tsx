import { EvaluationBuilder } from "../components/evaluation-builder";
import { SiteFrame } from "../components/site-frame";

export default function Home() {
  return (
    <SiteFrame>
      <section className="home-workbench">
        <div className="home-copy">
          <p className="role-kicker">00 · SECURITY PERIMETER</p>
          <h1 className="hero-title">
            <em>Check</em> a dataset before you buy it.
          </h1>
          <p className="hero-lede">
            Ask your questions. The seller sends a TLS-encrypted sample into
            0G private compute. You receive one verified score per question,
            never the raw rows.
          </p>

          <PrivateComputeTopology />

          <dl className="spec-list">
            <ProductPoint
              title="Encrypted in transit"
              text="TLS protects the sample while it travels to BlindSample and onward to 0G."
            />
            <ProductPoint
              title="Private inside 0G"
              text="The scoring request uses 0G private trust mode and requires TEE verification."
            />
            <ProductPoint
              title="Scoped, secured access"
              text="Buyer and seller receive separate capability links. Only token hashes are stored."
            />
            <ProductPoint
              title="No raw sample storage"
              text="The CSV is processed in server memory and never written to Supabase."
            />
          </dl>
        </div>

        <EvaluationBuilder />
      </section>

      <ContractMeter />

      <dl className="contract-stats" aria-label="Evaluation limits">
        <ContractStat label="questions maximum" value="20" />
        <ContractStat label="sample limit" value="200 KB" />
        <ContractStat label="score per question" value="1–100" />
      </dl>
    </SiteFrame>
  );
}

function ProductPoint({ text, title }: { text: string; title: string }) {
  return (
    <div className="spec-row">
      <dt>{title}</dt>
      <dd>{text}</dd>
    </div>
  );
}

function PrivateComputeTopology() {
  return (
    <figure className="privacy-topology">
      <figcaption className="sr-only">
        A TLS-encrypted sample passes through 0G private compute and returns
        secured scores without exposing raw rows.
      </figcaption>
      <div className="topology-track" aria-hidden="true">
        <div className="topology-node">
          <span>TLS</span>
          <small>ENCRYPTED TRANSIT</small>
        </div>
        <div className="topology-link" />
        <div className="topology-node topology-node--active">
          <span>
            <strong>0G</strong>
          </span>
          <small>PRIVATE TEE</small>
        </div>
        <div className="topology-link" />
        <div className="topology-node">
          <span>1–100</span>
          <small>SECURED SCORES</small>
        </div>
      </div>
    </figure>
  );
}

function ContractMeter() {
  return (
    <aside className="meter-strip" aria-label="BlindSample evaluation readout">
      <p>TRANSIT · TLS ENCRYPTED</p>
      <div className="meter-bars" aria-hidden="true">
        {Array.from({ length: 48 }, (_, index) => (
          <span key={index} />
        ))}
      </div>
      <p>OUTPUT · 0G PRIVATE</p>
    </aside>
  );
}

function ContractStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}
