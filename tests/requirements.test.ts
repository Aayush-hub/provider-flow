import { describe, expect, it } from "vitest";
import { allowedTransitions, canTransition, canonicalDegree, evaluateRequirements } from "../lib/requirements";
import type { DemoState } from "../lib/domain";

const state: DemoState = { role:"provider", selectedOrganizations:["northstar","evergreen","horizon"], profile:{degree:"MD",licenseState:"CA",licenseNumber:"A123",practiceAddress:"1 Demo St",education:"Demo University",graduationYear:"2010",malpracticeCarrier:"",hospitalAffiliation:"",disclosure:""}, documents:[], attested:false, cases:[], audit:[], practitioner: undefined };

describe("SharedCred requirement engine", () => {
  it("maps approved degree equivalents deterministically", () => {
    expect(canonicalDegree("M.D.")).toBe("MD");
    expect(canonicalDegree("Doctor of Medicine")).toBe("MD");
    expect(canonicalDegree("DNP")).toBe("DNP");
  });
  it("deduplicates shared requirements and preserves org-specific gaps", () => {
    const results = evaluateRequirements(state);
    expect(results.filter(r => r.id === "degree")).toHaveLength(1);
    expect(results.find(r => r.id === "degree")?.organizationIds).toHaveLength(3);
    expect(results.find(r => r.id === "hospital")?.satisfied).toBe(false);
    expect(results.find(r => r.id === "billing")?.satisfied).toBe(true);
  });
});

describe("credentialing state machine", () => {
  it("allows configured transitions and rejects shortcuts", () => {
    expect(canTransition("submitted","intake_review")).toBe(true);
    expect(canTransition("submitted","approved")).toBe(false);
    expect(allowedTransitions.approved).toEqual([]);
  });
});
