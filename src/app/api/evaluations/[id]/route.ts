import { handleGetEvaluation } from "../../../../lib/api/evaluations";

export const runtime = "nodejs";

export function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  return context.params.then(({ id }) =>
    handleGetEvaluation(request, id),
  );
}
