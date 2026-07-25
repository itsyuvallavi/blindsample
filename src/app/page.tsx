export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col px-6 py-8 sm:px-10 sm:py-10">
      <header className="flex items-center justify-between border-b border-white/10 pb-6">
        <span className="font-mono text-sm font-semibold tracking-[0.2em] text-white">
          BLINDSAMPLE
        </span>
        <span className="rounded-full border border-emerald-300/20 bg-emerald-300/5 px-3 py-1 font-mono text-xs text-emerald-200">
          0G PRIVATE COMPUTE
        </span>
      </header>

      <section className="flex flex-1 flex-col justify-center py-20 sm:py-28">
        <p className="mb-5 font-mono text-xs uppercase tracking-[0.24em] text-zinc-500">
          Private dataset suitability scoring
        </p>
        <h1 className="max-w-3xl text-4xl font-medium tracking-[-0.04em] text-white sm:text-6xl">
          Ask whether a dataset fits your needs without seeing its private
          rows.
        </h1>
        <p className="mt-7 max-w-2xl text-base leading-7 text-zinc-400 sm:text-lg">
          Buyers define the questions. Sellers provide a sample. BlindSample
          returns one independent 1–100 score per question through
          TEE-verified inference on 0G.
        </p>

        <div className="mt-12 grid max-w-3xl gap-px overflow-hidden rounded-2xl border border-white/10 bg-white/10 sm:grid-cols-3">
          {[
            ["01", "Buyer asks"],
            ["02", "Seller submits"],
            ["03", "0G scores privately"],
          ].map(([step, label]) => (
            <div key={step} className="bg-zinc-950 px-5 py-5">
              <p className="font-mono text-xs text-zinc-600">{step}</p>
              <p className="mt-3 text-sm text-zinc-200">{label}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="border-t border-white/10 pt-6 font-mono text-xs text-zinc-600">
        ETHGlobal Lisbon 2026 · MVP in progress
      </footer>
    </main>
  );
}
