import { afterEach, describe, expect, it, vi } from "vitest";

import { createEvaluation } from "./evaluations";

describe("browser evaluation API", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("submits only the name and plain-text questions", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      Response.json(
        {
          buyerPath: "/results/id#token=buyer",
          evaluationId: "id",
          expiresAt: "2099-01-01T00:00:00.000Z",
          sellerPath: "/submit/id#token=seller",
          status: "waiting_for_seller",
        },
        { status: 201 },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    await createEvaluation({
      questions: [
        {
          id: "btc_question",
          question: "Does market context explain BTC price movement?",
        },
      ],
      title: "BTC sample",
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/evaluations",
      expect.objectContaining({
        body: JSON.stringify({
          questions: [
            {
              id: "btc_question",
              question:
                "Does market context explain BTC price movement?",
            },
          ],
          title: "BTC sample",
        }),
      }),
    );
    expect(fetchMock.mock.calls[0][1].body).not.toContain("message");
    expect(fetchMock.mock.calls[0][1].body).not.toContain("columns");
    expect(fetchMock.mock.calls[0][1].body).not.toContain("kind");
  });
});
