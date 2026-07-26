import { afterEach, describe, expect, it } from "vitest";

import { getSupabaseServerClient } from "./client";
import {
  beginSellerSubmission,
  completeEvaluation,
  createEvaluation,
  getBuyerEvaluation,
  getSellerEvaluation,
} from "./evaluations";

const describeLive =
  process.env.SUPABASE_LIVE === "1" ? describe : describe.skip;
const createdIds: string[] = [];

describeLive("live Supabase evaluation persistence", () => {
  afterEach(async () => {
    if (createdIds.length === 0) {
      return;
    }

    const ids = createdIds.splice(0);
    const { error } = await getSupabaseServerClient()
      .from("evaluations")
      .delete()
      .in("id", ids);

    if (error) {
      throw new Error("Live test cleanup failed.", { cause: error });
    }
  });

  it("separates roles and permits exactly one submission claim", async () => {
    const created = await createEvaluation({
      questions: [
        {
          id: "question-1",
          text: "Does this sample contain complete order totals?",
        },
        {
          id: "question-2",
          text: "Is the sample recent enough for a weekly forecast?",
        },
      ],
      title: "Live persistence verification",
    });
    createdIds.push(created.id);

    const [sellerView, buyerView, sellerWithBuyerToken, buyerWithSellerToken] =
      await Promise.all([
        getSellerEvaluation(created.id, created.sellerToken),
        getBuyerEvaluation(created.id, created.buyerToken),
        getSellerEvaluation(created.id, created.buyerToken),
        getBuyerEvaluation(created.id, created.sellerToken),
      ]);

    expect(sellerView?.status).toBe("waiting_for_seller");
    expect(buyerView?.scores).toBeNull();
    expect(sellerWithBuyerToken).toBeNull();
    expect(buyerWithSellerToken).toBeNull();

    const claims = await Promise.all([
      beginSellerSubmission({
        id: created.id,
        sampleColumnCount: 4,
        sampleRowCount: 12,
        token: created.sellerToken,
      }),
      beginSellerSubmission({
        id: created.id,
        sampleColumnCount: 4,
        sampleRowCount: 12,
        token: created.sellerToken,
      }),
    ]);

    expect(claims.sort()).toEqual([false, true]);

    await completeEvaluation(created.id, {
      sampleColumnCount: 4,
      sampleRowCount: 12,
      scores: [
        { questionId: "question-1", score: 91 },
        { questionId: "question-2", score: 77 },
      ],
      trace: {
        model: "live-test-model",
        provider: "live-test-provider",
        requestId: "live-test-request",
        teeVerified: true,
      },
    });

    const completedBuyerView = await getBuyerEvaluation(
      created.id,
      created.buyerToken,
    );
    const completedSellerView = await getSellerEvaluation(
      created.id,
      created.sellerToken,
    );

    expect(completedBuyerView).toMatchObject({
      scores: [
        { questionId: "question-1", score: 91 },
        { questionId: "question-2", score: 77 },
      ],
      status: "complete",
      trace: {
        model: "live-test-model",
        provider: "live-test-provider",
        requestId: "live-test-request",
        teeVerified: true,
      },
    });
    expect(completedSellerView).not.toHaveProperty("scores");

    const { data: stored, error } = await getSupabaseServerClient()
      .from("evaluations")
      .select("buyer_token_hash, seller_token_hash")
      .eq("id", created.id)
      .single();

    expect(error).toBeNull();
    expect(stored?.buyer_token_hash).toMatch(/^[0-9a-f]{64}$/);
    expect(stored?.seller_token_hash).toMatch(/^[0-9a-f]{64}$/);
    expect(JSON.stringify(stored)).not.toContain(created.buyerToken);
    expect(JSON.stringify(stored)).not.toContain(created.sellerToken);
  });
});
