export function VerifiedResultStage() {
  return (
    <section
      className="verified-stage"
      aria-labelledby="verified-stage-heading"
    >
      <div className="verified-stage__copy">
        <p>What the buyer receives</p>
        <h2 id="verified-stage-heading">
          A useful answer, not the seller&apos;s rows.
        </h2>
        <span>
          Every question receives its own score, explanation, confidence, and
          safe evidence.
        </span>
      </div>

      <article className="verified-stage__result">
        <header>
          <span>Evaluated by 0G</span>
          <strong>TEE verified</strong>
        </header>
        <div className="verified-stage__question">
          <p>Buyer asks</p>
          <h3>
            Does this private news feed identify market-moving events before
            BTC reacts?
          </h3>
        </div>
        <div className="verified-stage__score">
          <div>
            <strong>82</strong>
            <span>/100</span>
          </div>
          <p>
            The sample usually identifies relevant events before the recorded
            price reaction.
          </p>
        </div>
        <footer>
          <span>High confidence</span>
          <strong>0 raw rows exposed</strong>
        </footer>
      </article>
    </section>
  );
}
