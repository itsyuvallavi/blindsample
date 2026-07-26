import { handleSubmitEvaluation } from "../../../../../lib/api/evaluations";

export const maxDuration = 60;
export const runtime = "nodejs";

export function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  return context.params.then(({ id }) =>
    handleSubmitEvaluation(request, id),
  );
}
