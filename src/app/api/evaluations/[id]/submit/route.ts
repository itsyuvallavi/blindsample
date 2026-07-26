import { handleSubmitEvaluation } from "../../../../../lib/api/evaluations";

// Keep enough function headroom around the 120-second 0G request timeout for
// Sample parsing, result validation, and atomic persistence.
export const maxDuration = 150;
export const runtime = "nodejs";

export function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  return context.params.then(({ id }) =>
    handleSubmitEvaluation(request, id),
  );
}
