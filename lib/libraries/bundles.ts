import type { RiskStatus } from "@/lib/scoring/risk";
import type {
  ControlEffectivenessStatus,
  ControlReviewFrequency,
} from "@/lib/validators/control";

export type RiskBundleTemplate = {
  title: string;
  description: string;
  category: string;
  impact: number;
  likelihood: number;
  status: RiskStatus;
  dueInDays: number | null;
};

export type ControlBundleTemplate = {
  code: string;
  title: string;
  description: string;
  controlType: string;
  reviewFrequency: ControlReviewFrequency;
  effectivenessStatus: ControlEffectivenessStatus;
  nextReviewInDays: number | null;
  linkedRiskTitles: string[];
};

export type LibraryBundle = {
  id: string;
  name: string;
  description: string;
  tags: string[];
  risks: RiskBundleTemplate[];
  controls: ControlBundleTemplate[];
};

const bundleDefinitions: LibraryBundle[] = [
  {
    id: "saas-security-baseline",
    name: "SaaS Security Baseline",
    description:
      "Starter set of common SaaS risks and controls for identity, access, and vulnerability hygiene.",
    tags: ["starter", "saas", "security"],
    risks: [
      {
        title: "Privileged accounts without mandatory MFA",
        description:
          "A subset of privileged users can still authenticate without MFA due to legacy policy exceptions.",
        category: "Identity",
        impact: 5,
        likelihood: 3,
        status: "open",
        dueInDays: 21,
      },
      {
        title: "Critical vulnerabilities breaching remediation SLA",
        description:
          "Critical vulnerabilities are not consistently remediated within the policy target window.",
        category: "Vulnerability",
        impact: 4,
        likelihood: 4,
        status: "open",
        dueInDays: 14,
      },
      {
        title: "Excessive production access assignments",
        description:
          "Production access recertification is manual and allows stale privileged group membership.",
        category: "Access Control",
        impact: 4,
        likelihood: 3,
        status: "draft",
        dueInDays: 30,
      },
    ],
    controls: [
      {
        code: "BASE-IAM-001",
        title: "Require MFA for all privileged accounts",
        description:
          "All privileged and administrator accounts must use MFA with no permanent exemptions.",
        controlType: "Preventive",
        reviewFrequency: "monthly",
        effectivenessStatus: "effective",
        nextReviewInDays: 30,
        linkedRiskTitles: ["Privileged accounts without mandatory MFA"],
      },
      {
        code: "BASE-VULN-002",
        title: "Weekly review of critical vulnerability backlog",
        description:
          "Track unresolved critical vulnerabilities weekly and enforce remediation ownership.",
        controlType: "Detective",
        reviewFrequency: "weekly",
        effectivenessStatus: "partially_effective",
        nextReviewInDays: 7,
        linkedRiskTitles: ["Critical vulnerabilities breaching remediation SLA"],
      },
      {
        code: "BASE-ACCESS-003",
        title: "Quarterly privileged access recertification",
        description:
          "Managers and system owners recertify privileged access on a defined quarterly cadence.",
        controlType: "Corrective",
        reviewFrequency: "quarterly",
        effectivenessStatus: "not_tested",
        nextReviewInDays: 45,
        linkedRiskTitles: ["Excessive production access assignments"],
      },
    ],
  },
  {
    id: "iso27001-control-starter",
    name: "ISO 27001 Control Starter",
    description:
      "Small ISO 27001-aligned control pack to accelerate initial control catalog setup.",
    tags: ["iso27001", "controls", "starter"],
    risks: [],
    controls: [
      {
        code: "ISO-A.5.15-001",
        title: "Access control policy maintenance",
        description:
          "Maintain and approve access control policy and associated standards on a recurring cadence.",
        controlType: "Preventive",
        reviewFrequency: "annual",
        effectivenessStatus: "effective",
        nextReviewInDays: 365,
        linkedRiskTitles: [],
      },
      {
        code: "ISO-A.8.8-001",
        title: "Technical vulnerability management process",
        description:
          "Maintain an accountable process to identify, assess, and remediate technical vulnerabilities.",
        controlType: "Detective",
        reviewFrequency: "monthly",
        effectivenessStatus: "partially_effective",
        nextReviewInDays: 30,
        linkedRiskTitles: [],
      },
    ],
  },
];

export function listLibraryBundles() {
  return bundleDefinitions;
}

export function getLibraryBundle(bundleId: string) {
  return bundleDefinitions.find((bundle) => bundle.id === bundleId) ?? null;
}

export function hasLibraryBundle(bundleId: string) {
  return bundleDefinitions.some((bundle) => bundle.id === bundleId);
}
