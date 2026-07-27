import Link from "next/link";
import type { ReactNode } from "react";

export function SiteFrame({
  children,
  compact = false,
  landing = false,
  role,
  variant = "task",
}: {
  children: ReactNode;
  compact?: boolean;
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
              C
            </span>
            <span>CipherQuery</span>
          </Link>
        ) : (
          <div className="wordmark" aria-label="CipherQuery">
            <span className="wordmark-mark" aria-hidden="true">
              C
            </span>
            <span>CipherQuery</span>
          </div>
        )}

        {publicFrame ? (
          <nav className="public-links" aria-label="Primary navigation">
            <Link href="/docs#workflow">How it works</Link>
            <Link href="/docs#privacy">Privacy</Link>
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
              <span>CipherQuery · Encrypted data evaluation</span>
              <span>Encrypted transport · 0G private compute</span>
            </>
          ) : (
            <>
              <span>{role ?? "Private evaluation"}</span>
              <span>Capability-protected session</span>
            </>
          )}
        </footer>
      )}
    </div>
  );
}
