const PAID_APPROVAL_FLAG = "ALLOW_PAID_0G";

export function paidLiveEnabled(
  suiteFlag: "END_TO_END_LIVE" | "SCORING_LIVE" | "ZERO_G_LIVE",
  environment: Readonly<Record<string, string | undefined>> = process.env,
) {
  return (
    environment[suiteFlag] === "1" &&
    environment[PAID_APPROVAL_FLAG] === "1"
  );
}
