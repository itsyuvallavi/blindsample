import Link from "next/link";
import type { ReactNode } from "react";

export function SiteFrame({
  children,
  compact = false,
  role,
}: {
  children: ReactNode;
  compact?: boolean;
  role?: string;
}) {
  return (
    <div className="site-shell">
      <header className="site-nav">
        <Link href="/" className="wordmark">
          <span>$</span> blindsample
        </Link>
        <code>private data, useful answers</code>
        <span className="system-chip" title="0G Private Computer">
          0G PRIVATE
        </span>
      </header>

      <main
        className={`site-main${compact ? " site-main--compact" : ""}`}
      >
        {role ? <p className="page-role">{role}</p> : null}
        {children}
      </main>

      <footer className="site-footer">
        <span>Built for ETHGlobal Lisbon 2026</span>
        <span>Private compute by 0G</span>
      </footer>
    </div>
  );
}
