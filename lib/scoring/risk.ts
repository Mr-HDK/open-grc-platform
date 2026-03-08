export const riskStatusOptions = [
  "draft",
  "open",
  "mitigated",
  "accepted",
  "closed",
] as const;

export const riskLevelOptions = ["low", "medium", "high", "critical"] as const;

export type RiskStatus = (typeof riskStatusOptions)[number];
export type RiskLevel = (typeof riskLevelOptions)[number];

export function calculateRiskScore(impact: number, likelihood: number) {
  return impact * likelihood;
}

export function deriveRiskLevel(score: number): RiskLevel {
  if (score <= 4) {
    return "low";
  }

  if (score <= 9) {
    return "medium";
  }

  if (score <= 16) {
    return "high";
  }

  return "critical";
}
