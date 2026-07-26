import Link from "next/link";
import type { ReactNode } from "react";

export function SiteFrame({
  children,
  compact = false,
}: {
  children: ReactNode;
  compact?: boolean;
}) {
  return (
    <div className="site-shell">
      <header className="site-nav">
        <Link href="/" className="wordmark">
          BLINDSAMPLE
        </Link>
        <span className="system-chip" title="0G Private Computer">
          0G PRIVATE
        </span>
      </header>

      <main
        className={`site-main${compact ? " site-main--compact" : ""}`}
      >
        {children}
      </main>

      <footer className="site-footer">
        <span>ETHGlobal Lisbon 2026</span>
        <span>
          TLS encrypted in transit · private on 0G · no stored CSV
        </span>
      </footer>
    </div>
  );
}
