export type GeneratedEvaluationScenario = {
  csv: string;
  id: string;
  questions: Array<{
    expected: { exact: number };
    id: string;
    question: string;
  }>;
  title: string;
};

export const GENERATED_ADVERSARIAL_SCENARIOS = [
  generateLedgerScenario(),
  generateMinuteSeriesScenario(),
  generateSupportScenario(),
] satisfies GeneratedEvaluationScenario[];

function generateLedgerScenario(): GeneratedEvaluationScenario {
  const rows = Array.from({ length: 37 }, (_, index) => {
    const transactionId =
      index % 13 === 0
        ? ""
        : index > 0 && index % 11 === 0
          ? `TX-${index - 1}`
          : `TX-${index}`;
    const timestamp =
      index % 8 === 0
        ? "invalid-timestamp"
        : new Date(
            Date.UTC(2026, 6, 26, 12, index),
          ).toISOString();
    const amount =
      index % 9 === 0
        ? "not-numeric"
        : index % 7 === 0
          ? "-5"
          : String(10 + index);

    return { amount, timestamp, transaction_id: transactionId };
  });
  const shuffled = seededShuffle(rows, 260_726);
  const idCounts = countBy(
    rows.filter((row) => row.transaction_id !== ""),
    (row) => row.transaction_id,
  );
  const uniqueIds = rows.filter(
    (row) =>
      row.transaction_id !== "" &&
      idCounts.get(row.transaction_id) === 1,
  ).length;
  const validTimestamps = rows.filter((row) =>
    isIsoTimestamp(row.timestamp),
  ).length;
  const validAmounts = rows.filter((row) => {
    const amount = Number(row.amount);
    return row.amount !== "" && Number.isFinite(amount) && amount >= 0;
  }).length;

  return {
    csv: toCsv(
      ["transaction_id", "timestamp", "amount"],
      shuffled,
    ),
    id: "generated-ledger-integrity",
    questions: [
      {
        expected: { exact: percentage(uniqueIds, rows.length) },
        id: "unique_transaction_ids",
        question:
          "What percentage of records contain a non-empty transaction_id that appears exactly once in the submitted sample?",
      },
      {
        expected: {
          exact: percentage(validTimestamps, rows.length),
        },
        id: "valid_ledger_timestamps",
        question:
          "What percentage of timestamp values are valid ISO 8601 timestamps?",
      },
      {
        expected: { exact: percentage(validAmounts, rows.length) },
        id: "valid_ledger_amounts",
        question:
          "What percentage of amount values are numeric and greater than or equal to zero?",
      },
    ],
    title: "Generated ledger integrity",
  };
}

function generateMinuteSeriesScenario(): GeneratedEvaluationScenario {
  const missingMinutes = new Set([4, 11, 19, 27]);
  const blankReadingMinutes = new Set([6, 15, 23]);
  const rows = Array.from({ length: 30 }, (_, minute) => minute)
    .filter((minute) => !missingMinutes.has(minute))
    .map((minute) => ({
      reading: blankReadingMinutes.has(minute)
        ? ""
        : String(200 + minute),
      timestamp: minuteTimestamp(minute),
    }));

  rows.push({ reading: "207.5", timestamp: minuteTimestamp(7) });
  rows.push({ reading: "245", timestamp: minuteTimestamp(45) });

  const shuffled = seededShuffle(rows, 260_727);
  const timestampCounts = countBy(rows, (row) => row.timestamp);
  const validRequiredMinutes = Array.from(
    { length: 30 },
    (_, minute) => minute,
  ).filter((minute) => {
    const timestamp = minuteTimestamp(minute);
    const matchingRows = rows.filter(
      (row) => row.timestamp === timestamp,
    );

    return (
      matchingRows.length === 1 &&
      matchingRows[0].reading !== "" &&
      Number.isFinite(Number(matchingRows[0].reading))
    );
  }).length;
  const numericReadings = rows.filter(
    (row) =>
      row.reading !== "" && Number.isFinite(Number(row.reading)),
  ).length;
  const uniqueTimestampRecords = rows.filter(
    (row) => timestampCounts.get(row.timestamp) === 1,
  ).length;

  return {
    csv: toCsv(["timestamp", "reading"], shuffled),
    id: "generated-minute-series",
    questions: [
      {
        expected: {
          exact: percentage(validRequiredMinutes, 30),
        },
        id: "complete_minute_series",
        question:
          "For every minute from 2026-07-26 10:00 through 10:29 UTC inclusive, a valid interval must have exactly one timestamp record and a numeric reading. Score this as valid required intervals divided by 30 times 100.",
      },
      {
        expected: {
          exact: percentage(numericReadings, rows.length),
        },
        id: "numeric_series_readings",
        question:
          "What percentage of submitted records contain a numeric reading value?",
      },
      {
        expected: {
          exact: percentage(uniqueTimestampRecords, rows.length),
        },
        id: "unique_series_timestamps",
        question:
          "What percentage of submitted records have a timestamp that appears exactly once in the submitted sample?",
      },
    ],
    title: "Generated minute series",
  };
}

function generateSupportScenario(): GeneratedEvaluationScenario {
  const accountRequests = [
    "Please restore access to my locked account.",
    "My card was charged twice; please correct the payment.",
    "Password recovery fails after verification; please restore access.",
    "Please close my account before the next billing date.",
    "The payment screen rejects my valid card; please investigate.",
    "I cannot sign in after changing my email address.",
    "Please refund the duplicate subscription payment.",
    "Two-factor authentication blocks account access; please reset it.",
  ];
  const otherSupportRequests = [
    "Please locate my delayed shipment and provide a delivery update.",
    "Please replace the damaged product that arrived today.",
    "The export button fails; please help me download the report.",
    "Please cancel the unshipped order before dispatch.",
  ];
  const productFeedback = [
    "Positive feedback: the new dashboard is easy to use.",
    "The packaging design looks polished and professional.",
    "The latest search layout feels faster and clearer.",
    "The product documentation is concise and helpful.",
  ];
  const unrelatedMessages = [
    "The weather forecast predicts rain across the coast.",
    "A local football match begins on Saturday afternoon.",
    "The city library opens a new history exhibition.",
    "A cooking class is teaching sourdough techniques.",
  ];
  const rows = seededShuffle(
    [
      ...accountRequests.map((message) => ({ message })),
      ...otherSupportRequests.map((message) => ({ message })),
      ...productFeedback.map((message) => ({ message })),
      ...unrelatedMessages.map((message) => ({ message })),
    ],
    260_728,
  );

  return {
    csv: toCsv(["message"], rows),
    id: "generated-support-semantics",
    questions: [
      {
        expected: {
          exact: percentage(
            accountRequests.length + otherSupportRequests.length,
            rows.length,
          ),
        },
        id: "clear_support_requests",
        question:
          "What percentage of messages clearly describe a customer-support request that requires an agent response?",
      },
      {
        expected: {
          exact: percentage(accountRequests.length, rows.length),
        },
        id: "account_payment_access",
        question:
          "What percentage of messages explicitly describe an account, payment, or access problem?",
      },
      {
        expected: {
          exact: percentage(unrelatedMessages.length, rows.length),
        },
        id: "unrelated_messages",
        question:
          "What percentage of messages are unrelated to both customer support and product experience?",
      },
    ],
    title: "Generated support semantics",
  };
}

function minuteTimestamp(minute: number) {
  return new Date(
    Date.UTC(2026, 6, 26, 10, minute),
  ).toISOString();
}

function isIsoTimestamp(value: string) {
  return (
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(
      value,
    ) && !Number.isNaN(Date.parse(value))
  );
}

function percentage(numerator: number, denominator: number) {
  return Math.round((numerator / denominator) * 100);
}

function countBy<T>(values: T[], key: (value: T) => string) {
  const counts = new Map<string, number>();

  for (const value of values) {
    const itemKey = key(value);
    counts.set(itemKey, (counts.get(itemKey) ?? 0) + 1);
  }

  return counts;
}

function seededShuffle<T>(values: T[], seed: number) {
  const shuffled = [...values];
  const random = mulberry32(seed);

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const target = Math.floor(random() * (index + 1));
    [shuffled[index], shuffled[target]] = [
      shuffled[target],
      shuffled[index],
    ];
  }

  return shuffled;
}

function mulberry32(seed: number) {
  let state = seed;

  return () => {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let value = Math.imul(state ^ (state >>> 15), 1 | state);
    value =
      (value +
        Math.imul(value ^ (value >>> 7), 61 | value)) ^
      value;

    return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296;
  };
}

function toCsv<T extends Record<string, string>>(
  columns: Array<keyof T & string>,
  rows: T[],
) {
  return [
    columns.join(","),
    ...rows.map((row) =>
      columns.map((column) => csvCell(row[column])).join(","),
    ),
  ].join("\n");
}

function csvCell(value: string) {
  if (!/[",\n\r]/.test(value)) {
    return value;
  }

  return `"${value.replaceAll('"', '""')}"`;
}
