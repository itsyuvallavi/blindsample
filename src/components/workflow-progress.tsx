export type WorkflowStage = "questions" | "sample" | "results";

const STAGES: Array<{ id: WorkflowStage; label: string }> = [
  { id: "questions", label: "Ask questions" },
  { id: "sample", label: "Submit sample" },
  { id: "results", label: "View results" },
];

export function WorkflowProgress({
  current,
}: {
  current: WorkflowStage;
}) {
  const currentIndex = STAGES.findIndex((stage) => stage.id === current);

  return (
    <nav className="workflow-progress" aria-label="Evaluation workflow">
      <ol>
        {STAGES.map((stage, index) => {
          const state =
            index < currentIndex
              ? "complete"
              : index === currentIndex
                ? "current"
                : "upcoming";

          return (
            <li
              key={stage.id}
              data-state={state}
              aria-current={state === "current" ? "step" : undefined}
            >
              <span aria-hidden="true">{index + 1}</span>
              {stage.label}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
