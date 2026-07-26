export function StatusMessage({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
  tone?: "error" | "neutral" | "success";
}) {
  const mark = {
    error: "×",
    neutral: "·",
    success: "✓",
  }[tone];

  return (
    <div
      className="status-message"
      data-tone={tone}
      role={tone === "error" ? "alert" : "status"}
    >
      <span className="status-message__mark" aria-hidden="true">
        {mark}
      </span>
      <span>{children}</span>
    </div>
  );
}
