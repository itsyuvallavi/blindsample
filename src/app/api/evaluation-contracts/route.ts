import { handlePreviewEvaluationContracts } from "../../../lib/api/evaluations";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  return handlePreviewEvaluationContracts(request);
}
