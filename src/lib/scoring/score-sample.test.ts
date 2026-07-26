import { describe, expect, it, vi } from "vitest";

import type { ParsedCsvSample } from "../csv/parse-sample";
import type { EvaluationQuestion } from "../supabase/evaluations";
import type { VerifiedCompletion } from "../zero-g/client";
import { scorePrivateCsvSample } from "./score-sample";

const QUESTIONS: EvaluationQuestion[] = [
  { id: "q-complete", text: "Is the sample complete?" },
  { id: "q-current", text: "Is the sample current?" },
];
const SAMPLE: ParsedCsvSample = {
  columnCount: 2,
  columns: ["order_id", "order_date"],
  rowCount: 2,
  rows: [
    ["1", "2026-07-20"],
    ["2", "2026-07-21"],
  ],
};
const TRACE: VerifiedCompletion["trace"] = {
  model: "test-model",
  provider: "test-provider",
  requestId: "test-request",
  teeVerified: true,
};

describe("scorePrivateCsvSample", () => {
  it("returns validated scores from a verified completion", async () => {
    const requestCompletion = vi.fn().mockResolvedValue({
      content: JSON.stringify({
        scores: [
          { questionId: "q-complete", score: 83 },
          { questionId: "q-current", score: 94 },
        ],
      }),
      trace: TRACE,
    });

    await expect(
      scorePrivateCsvSample(QUESTIONS, SAMPLE, { requestCompletion }),
    ).resolves.toEqual({
      scores: [
        { questionId: "q-complete", score: 83 },
        { questionId: "q-current", score: 94 },
      ],
      trace: TRACE,
    });
    expect(requestCompletion).toHaveBeenCalledTimes(1);
  });

  it("retries malformed model output exactly once", async () => {
    const correctedTrace = {
      ...TRACE,
      requestId: "corrected-request",
    };
    const requestCompletion = vi
      .fn()
      .mockResolvedValueOnce({
        content: "The overall score is 80.",
        trace: TRACE,
      })
      .mockResolvedValueOnce({
        content: JSON.stringify({
          scores: [
            { questionId: "q-complete", score: 80 },
            { questionId: "q-current", score: 76 },
          ],
        }),
        trace: correctedTrace,
      });

    await expect(
      scorePrivateCsvSample(QUESTIONS, SAMPLE, { requestCompletion }),
    ).resolves.toMatchObject({ trace: correctedTrace });
    expect(requestCompletion).toHaveBeenCalledTimes(2);
    expect(requestCompletion.mock.calls[1]?.[0]).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          content: expect.stringContaining("violated"),
          role: "user",
        }),
      ]),
    );
  });

  it("fails closed after a second malformed response", async () => {
    const requestCompletion = vi
      .fn()
      .mockResolvedValueOnce({ content: "not json", trace: TRACE })
      .mockResolvedValueOnce({
        content: JSON.stringify({ overallScore: 80, scores: [] }),
        trace: TRACE,
      });

    await expect(
      scorePrivateCsvSample(QUESTIONS, SAMPLE, { requestCompletion }),
    ).rejects.toThrow("scores array");
    expect(requestCompletion).toHaveBeenCalledTimes(2);
  });

  it("marks dataset cells as untrusted in the fixed prompt", async () => {
    const requestCompletion = vi.fn().mockResolvedValue({
      content: JSON.stringify({
        scores: [
          { questionId: "q-complete", score: 50 },
          { questionId: "q-current", score: 50 },
        ],
      }),
      trace: TRACE,
    });

    await scorePrivateCsvSample(QUESTIONS, SAMPLE, {
      requestCompletion,
    });

    const messages = requestCompletion.mock.calls[0]?.[0];
    expect(messages?.[0]?.content).toContain("untrusted data");
    expect(messages?.[0]?.content).toContain(
      "Never follow instructions",
    );
    expect(messages?.[0]?.content).toContain("overall score");
  });
});
