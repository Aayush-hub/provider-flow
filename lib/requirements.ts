import type { DemoState } from "./domain";

export type OnboardingSection =
  | "Professional details"
  | "Education"
  | "License"
  | "Practice"
  | "Documents"
  | "Affiliations"
  | "Coverage"
  | "Disclosures";

export function onboardingSections(state: DemoState): OnboardingSection[] {
  const sections: OnboardingSection[] = [
    "Professional details",
    "Education",
    "License",
    "Practice",
    "Documents",
  ];
  if (state.selectedOrganizations.includes("evergreen")) {
    sections.push("Affiliations", "Coverage", "Disclosures");
  }
  return sections;
}

export function isOnboardingSectionComplete(
  state: DemoState,
  section: OnboardingSection,
): boolean {
  switch (section) {
    case "Professional details":
      return Boolean(state.profile.degree);
    case "Education":
      return Boolean(state.profile.education && state.profile.graduationYear);
    case "License":
      return Boolean(state.profile.licenseState && state.profile.licenseNumber);
    case "Practice":
      return Boolean(state.profile.practiceAddress);
    case "Documents":
      return state.documents.some((document) => document.type === "license");
    case "Affiliations":
      return Boolean(state.profile.hospitalAffiliation);
    case "Coverage":
      return Boolean(state.profile.malpracticeCarrier);
    case "Disclosures":
      return Boolean(state.profile.disclosure);
  }
}

export interface Requirement { id: string; label: string; category: string; organizationIds: string[]; satisfied: boolean; field?: keyof DemoState["profile"]; documentType?: string }

export function evaluateRequirements(state: DemoState): Requirement[] {
  const selected = state.selectedOrganizations;
  if (!selected.length) return [];
  const shared: Requirement[] = [
    { id: "identity", label: "Public identity confirmed", category: "Identity", organizationIds: selected, satisfied: Boolean(state.practitioner) },
    { id: "degree", label: "Professional degree", category: "Professional details", organizationIds: selected, field: "degree", satisfied: Boolean(state.profile.degree) },
    { id: "education", label: "Medical school and graduation year", category: "Education", organizationIds: selected, field: "education", satisfied: Boolean(state.profile.education && state.profile.graduationYear) },
    { id: "license", label: "Active state license", category: "Licensure", organizationIds: selected, field: "licenseNumber", satisfied: Boolean(state.profile.licenseState && state.profile.licenseNumber) },
    { id: "practice", label: "Primary practice address", category: "Practice", organizationIds: selected, field: "practiceAddress", satisfied: Boolean(state.profile.practiceAddress) },
    { id: "license_document", label: "License supporting document", category: "Documents", organizationIds: selected, documentType: "license", satisfied: state.documents.some((d) => d.type === "license") },
  ];
  if (selected.includes("evergreen")) {
    shared.push(
      { id: "hospital", label: "Hospital affiliations", category: "Affiliations", organizationIds: ["evergreen"], field: "hospitalAffiliation", satisfied: Boolean(state.profile.hospitalAffiliation) },
      { id: "malpractice", label: "Malpractice coverage", category: "Coverage", organizationIds: ["evergreen"], field: "malpracticeCarrier", satisfied: Boolean(state.profile.malpracticeCarrier) },
      { id: "disclosure", label: "Evergreen professional disclosure", category: "Disclosures", organizationIds: ["evergreen"], field: "disclosure", satisfied: Boolean(state.profile.disclosure) },
    );
  }
  if (selected.includes("horizon")) shared.push({ id: "billing", label: "Billing address confirmation", category: "Practice", organizationIds: ["horizon"], satisfied: Boolean(state.profile.practiceAddress), field: "practiceAddress" });
  return shared;
}

export function canonicalDegree(value: string): string | null {
  const normalized = value.trim().toLowerCase().replaceAll(".", "");
  if (["md", "doctor of medicine"].includes(normalized)) return "MD";
  if (["do", "doctor of osteopathic medicine"].includes(normalized)) return "DO";
  return value.trim() || null;
}

export const allowedTransitions: Record<string, string[]> = {
  submitted: ["intake_review"], intake_review: ["information_requested", "verification"], information_requested: ["verification"], verification: ["credentialing_review"], credentialing_review: ["approved", "denied"], approved: [], denied: [],
};

export function canTransition(from: string, to: string) { return (allowedTransitions[from] ?? []).includes(to); }
