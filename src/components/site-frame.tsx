import Link from "next/link";
import type { ReactNode } from "react";

export function SiteFrame({
  children,
  compact = false,
  role,
  variant = "task",
}: {
  children: ReactNode;
  compact?: boolean;
  role?: string;
  variant?: "public" | "task";
}) {
  const publicFrame = variant === "public";

  return (
    <div className={`site-shell site-shell--${variant}`}>
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <header className="site-nav">
        {publicFrame ? (
          <Link href="/" className="wordmark" aria-label="BlindSample home">
            <span className="wordmark-mark" aria-hidden="true">
              B
            </span>
            <span>BlindSample</span>
          </Link>
        ) : (
          <div className="wordmark" aria-label="BlindSample">
            <span className="wordmark-mark" aria-hidden="true">
              B
            </span>
            <span>BlindSample</span>
          </div>
        )}

        {publicFrame ? (
          <nav className="public-links" aria-label="Primary navigation">
            <Link href="/#how-it-works">How it works</Link>
            <Link href="/#privacy">Privacy</Link>
            <Link href="/docs">Docs</Link>
            <Link className="nav-cta" href="/new">
              Create evaluation
            </Link>
          </nav>
        ) : (
          <div className="task-context">
            {role ? <span>{role}</span> : null}
            <span className="system-chip" title="0G Private Computer">
              0G private
            </span>
          </div>
        )}
      </header>

      <main
        id="main-content"
        className={`site-main${compact ? " site-main--compact" : ""}`}
      >
        {children}
      </main>

      <footer className="site-footer">
        {publicFrame ? (
          <>
            <span>BlindSample · Secure private data evaluation</span>
            <span>Encrypted transport · 0G private compute</span>
          </>
        ) : (
          <>
            <span>{role ?? "Private evaluation"}</span>
            <span>Capability-protected session</span>
          </>
        )}
      </footer>
    </div>
  );
}
