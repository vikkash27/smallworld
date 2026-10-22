import { describe, expect, it } from "vitest";
import { formatEvidenceDate, fitLabel } from "@/components/discovery/labels";
import { circleHandoffPath } from "@/ui/discovery/client";

describe("fitLabel", () => {
  it.each([
    ["experience", "Relevant experience"],
    ["complementary_need", "Complementary need"],
    ["collaborator", "Potential collaborator"],
    ["peer", "Peer"],
  ] as const)("%s -> %s", (fit, label) => {
    expect(fitLabel(fit)).toBe(label);
  });
});

describe("formatEvidenceDate", () => {
  it("renders an en-GB date", () => {
    expect(formatEvidenceDate("2026-10-21T15:00:00Z")).toBe("21 Oct 2026");
  });

  it("says 'date unknown' for null", () => {
    expect(formatEvidenceDate(null)).toBe("date unknown");
  });
});

describe("circleHandoffPath", () => {
  it("builds the handoff URL for the demo search", () => {
    expect(circleHandoffPath("demo-search-robotics")).toBe(
      "/circles/new?searchId=demo-search-robotics",
    );
  });

  it("encodes unsafe characters", () => {
    expect(circleHandoffPath("a b&c")).toBe("/circles/new?searchId=a%20b%26c");
  });
});
