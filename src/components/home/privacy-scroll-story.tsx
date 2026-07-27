"use client";

import { useEffect, useRef, useState } from "react";

const STORY_STAGES = [
  {
    body: "The seller adds a sample to the buyer’s questions. Both travel together in one encrypted request.",
    label: "Submit",
    meta: "Encrypted in transit",
    nodeDetail: "Encrypted request",
    nodeTitle: "Questions + sample",
    title: "Questions and sample enter together.",
  },
  {
    body: "0G processes the request in memory inside protected hardware.",
    label: "Evaluate",
    meta: "Private compute",
    nodeDetail: "Memory-only TEE",
    nodeTitle: "0G Private Computer",
    title: "0G evaluates inside a TEE.",
  },
  {
    body: "The buyer receives a score and safe evidence. The seller’s rows never return.",
    label: "Verify",
    meta: "Verified output only",
    nodeDetail: "No raw rows",
    nodeTitle: "Score + evidence",
    title: "Only the verified answer returns.",
  },
] as const;

export function PrivacyScrollStory() {
  const [activeStage, setActiveStage] = useState(0);
  const markersRef = useRef<Array<HTMLDivElement | null>>([]);

  useEffect(() => {
    const markers = markersRef.current.filter(
      (marker): marker is HTMLDivElement => marker !== null,
    );

    if (!markers.length || typeof IntersectionObserver === "undefined") {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const visibleEntry = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];

        if (!visibleEntry) {
          return;
        }

        const index = Number(
          (visibleEntry.target as HTMLElement).dataset.stage,
        );

        if (Number.isInteger(index)) {
          setActiveStage(index);
        }
      },
      {
        rootMargin: "-30% 0px -42%",
        threshold: [0.15, 0.35, 0.6],
      },
    );

    markers.forEach((marker) => observer.observe(marker));
    return () => observer.disconnect();
  }, []);

  return (
    <section className="privacy-story" aria-labelledby="privacy-story-heading">
      <div className="privacy-story__sticky">
        <div className="privacy-story__copy">
          <p>How privacy moves</p>
          <h2 id="privacy-story-heading">
            The data moves through one protected path.
          </h2>
          <ol aria-label="Private evaluation stages">
            {STORY_STAGES.map((item, index) => (
              <li
                data-active={index === activeStage}
                key={item.label}
              >
                <span>{index + 1}</span>
                <strong>{item.label}</strong>
              </li>
            ))}
          </ol>
        </div>

        <div
          className="privacy-story__stage"
          data-stage={activeStage}
          aria-hidden="true"
        >
          <div className="privacy-story__stage-topline">
            <span>Private evaluation flow</span>
            <span className="privacy-story__meta">
              {STORY_STAGES.map((item, index) => (
                <span
                  data-active={index === activeStage}
                  key={item.label}
                >
                  {item.meta}
                </span>
              ))}
            </span>
          </div>

          <div className="privacy-story__diagram">
            <span
              className="privacy-story__active-panel"
              style={{ transform: `translateX(${activeStage * 100}%)` }}
            />
            {STORY_STAGES.map((item, index) => {
              const state =
                index < activeStage
                  ? "complete"
                  : index === activeStage
                    ? "active"
                    : "pending";

              return (
                <article
                  className="privacy-story__pipeline-step"
                  data-state={state}
                  key={item.label}
                >
                  <span>{item.label}</span>
                  <h3>{item.nodeTitle}</h3>
                  <p>{item.nodeDetail}</p>
                </article>
              );
            })}
          </div>

          <div className="privacy-story__stage-copy">
            {STORY_STAGES.map((item, index) => (
              <article
                data-active={index === activeStage}
                key={item.label}
              >
                <h3>{item.title}</h3>
                <span>{item.body}</span>
              </article>
            ))}
          </div>
        </div>
      </div>

      <div className="privacy-story__markers" aria-hidden="true">
        {STORY_STAGES.map((item, index) => (
          <div
            data-stage={index}
            key={item.label}
            ref={(element) => {
              markersRef.current[index] = element;
            }}
          />
        ))}
      </div>

      <div className="privacy-story__mobile">
        {STORY_STAGES.map((item, index) => (
          <article key={item.label}>
            <span>{String(index + 1).padStart(2, "0")}</span>
            <div>
              <p>{item.meta}</p>
              <h3>{item.title}</h3>
              <strong>{item.body}</strong>
            </div>
          </article>
        ))}
      </div>

      <ol className="visually-hidden">
        {STORY_STAGES.map((item) => (
          <li key={item.label}>
            <strong>{item.label}.</strong> {item.title} {item.body}
          </li>
        ))}
      </ol>
    </section>
  );
}
