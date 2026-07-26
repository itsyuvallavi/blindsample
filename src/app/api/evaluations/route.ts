import { handleCreateEvaluation } from "../../../lib/api/evaluations";

export const runtime = "nodejs";

export function POST(request: Request) {
  return handleCreateEvaluation(request);
}
