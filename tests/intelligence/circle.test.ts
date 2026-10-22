import { describe, expect, it } from "vitest";
import type { PersonRecommendation } from "../../src/shared/contracts";
import { draftCircle } from "../../src/server/intelligence/circle/draft";

const ROBOTICS_GOAL = "I want to build warehouse robotics with people in London.";

const FORBIDDEN = [
  "agreed to join",
  "has agreed",
  "confirmed members",
  "will join",
  "are attending",
];

function person(id: string): PersonRecommendation {
  return {
    member: {
      id,
      displayName: id,
      initials: "XX",
      communityIds: ["unicorn-mafia"],
    },
    fitType: "experience",
    reason: "Relevant stated experience.",
    evidence: [],
    caveats: [],
    availability: "unknown",
  };
}

const roboticsPeople = [
  person("demo-amara"),
  person("demo-leo"),
  person("demo-nina"),
];

describe("draftCircle", () => {
  it("returns null when nobody is proposed", () => {
    expect(draftCircle(ROBOTICS_GOAL, [])).toBeNull();
    expect(draftCircle("build warehouse robotics", [])).toBeNull();
  });

  it("returns null when the goal is empty or only punctuation and stopwords", () => {
    const goals = ["", "   ", "...", "!!?", "I want to, with our; and the.", "a an the of in for"];
    for (const goal of goals) {
      expect(draftCircle(goal, roboticsPeople)).toBeNull();
    }
  });

  it("drafts the robotics circle from the three demo members only", () => {
    const draft = draftCircle(ROBOTICS_GOAL, roboticsPeople);

    expect(draft).not.toBeNull();
    expect(draft?.proposedMemberIds).toEqual(["demo-amara", "demo-leo", "demo-nina"]);
    expect(draft?.capacity).toBe(6);
    expect(draft?.minimumMembers).toBe(3);
    expect(draft?.activity.proposedStartsAt).toBeNull();
    expect(draft?.activity.timezone).toBe("Europe/London");
    expect(draft?.activity.location).toBeNull();
    expect(draft?.activity.title).toBe("Bring one concrete problem");
    expect(draft?.activity.description).toContain("warehouse");
    expect(draft?.activity.description).toContain("robotics");
    expect(draft?.activity.description).toContain("Time to be agreed");
    expect(draft?.title).toBe("build warehouse robotics people London Circle");
    expect(draft?.purpose).toBe(
      "Work together on build warehouse robotics people London. This is a proposal, not a confirmed commitment.",
    );
    expect(draft?.activity.description).toBe(
      "A 30-minute session on build warehouse robotics people London. Each person brings one real problem or prototype related to the goal. Time to be agreed.",
    );

    const visible = [draft?.title, draft?.purpose, draft?.activity.title, draft?.activity.description]
      .join("\n")
      .toLowerCase();
    for (const phrase of FORBIDDEN) {
      expect(visible).not.toContain(phrase);
    }
    expect(visible).not.toContain("accepted");
  });

  it("keeps proposed member ids in input order and does not insert a host", () => {
    const ordered = [person("demo-nina"), person("demo-amara"), person("demo-leo")];
    const draft = draftCircle(ROBOTICS_GOAL, ordered);

    expect(draft?.proposedMemberIds).toEqual(["demo-nina", "demo-amara", "demo-leo"]);
    expect(draft?.proposedMemberIds).not.toContain("viewer-vikkash");
  });

  it("preserves goal casing after stripping punctuation and stopwords", () => {
    const draft = draftCircle("I WANT TO Build WAREHOUSE Robotics!!!", roboticsPeople);

    expect(draft?.title).toBe("Build WAREHOUSE Robotics Circle");
    expect(draft?.purpose).toContain("Build WAREHOUSE Robotics");
  });

  it("caps topic and title at 80 characters", () => {
    const draft = draftCircle("B".repeat(90), roboticsPeople);
    const topic = "B".repeat(80);

    expect(draft?.title.length).toBeLessThanOrEqual(80);
    expect(draft?.title).toBe(topic);
    expect(draft?.purpose.startsWith(`Work together on ${topic}.`)).toBe(true);
    expect(draft?.activity.description.startsWith(`A 30-minute session on ${topic}.`)).toBe(true);
  });
});
