import Link from "next/link";
import type { ReactNode } from "react";

export function SiteFrame({
  children,
  compact = false,
  currentPage,
  landing = false,
  role,
  variant = "task",
}: {
  children: ReactNode;
  compact?: boolean;
  currentPage?: "docs" | "home" | "new";
  landing?: boolean;
  role?: string;
  variant?: "public" | "task";
}) {
  const publicFrame = variant === "public";

  return (
    <div
      className={`site-shell site-shell--${variant}${
        landing ? " site-shell--landing" : ""
      }`}
    >
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <header className="site-nav">
        {publicFrame ? (
          <Link href="/" className="wordmark" aria-label="CipherQuery home">
            <span className="wordmark-mark" aria-hidden="true">
              CQ
            </span>
            <span>CipherQuery</span>
          </Link>
        ) : (
          <div className="wordmark" aria-label="CipherQuery">
            <span className="wordmark-mark" aria-hidden="true">
              CQ
            </span>
            <span>CipherQuery</span>
          </div>
        )}

        {publicFrame ? (
          <nav className="public-links" aria-label="Primary navigation">
            {currentPage !== "docs" ? (
              <Link href="/docs">Docs</Link>
            ) : null}
            {!landing && currentPage !== "new" ? (
              <Link className="nav-cta" href="/new">
                Create evaluation
              </Link>
            ) : null}
          </nav>
        ) : (
          <div className="task-context">
            {role ? <span>{role}</span> : null}
            <span className="system-chip" title="Capability-protected session">
              Secure session
            </span>
          </div>
        )}
      </header>

      <main
        id="main-content"
        className={`site-main${compact ? " site-main--compact" : ""}${
          landing ? " site-main--landing" : ""
        }`}
      >
        {children}
      </main>

      {landing ? null : (
        <footer className="site-footer">
          {publicFrame ? (
            <>
              <span>CipherQuery</span>
              <span>Private data evaluation</span>
            </>
          ) : (
            <>
              <span>{role ?? "Private evaluation"}</span>
              <span>Encrypted · capability protected</span>
            </>
          )}
        </footer>
      )}
    </div>
  );
}
