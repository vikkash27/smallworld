import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { CommunitiesView } from "@/components/communities/CommunitiesView";
import {
  filterCommunities,
  formatVerifiedDate,
  statusLabel,
} from "@/components/communities/filter";
import { bootstrap } from "./fixtures";

const UNICORN_URL = "https://www.linkedin.com/company/unicorn-mafia/";

function renderDirectory() {
  const { communities } = bootstrap();
  const user = userEvent.setup();
  render(<CommunitiesView communities={communities} />);
  return { user, communities };
}

/** Nearest ancestor of the community name that owns a "View community" button = that community's card. */
function cardFor(name: string): HTMLElement {
  let el: HTMLElement | null = screen.getByRole("heading", { name });
  while (el) {
    if (within(el).queryAllByRole("button", { name: "View community" }).length === 1) return el;
    el = el.parentElement;
  }
  throw new Error(`No card with a "View community" button found for ${name}`);
}

describe("communities directory (bootstrap.sample.json)", () => {
  it("fixture sanity: 12 communities with unique ids", () => {
    const { communities } = bootstrap();
    expect(communities).toHaveLength(12);
    expect(new Set(communities.map((c) => c.id)).size).toBe(12);
  });

  it("lists all 12 communities with the '12 of 12 communities' count", () => {
    const { communities } = renderDirectory();
    expect(screen.getAllByRole("button", { name: "View community" })).toHaveLength(12);
    for (const c of communities) {
      expect(screen.getByRole("heading", { name: c.name })).toBeInTheDocument();
    }
    expect(screen.getByText("12 of 12 communities")).toBeInTheDocument();
  });

  it("keeps 'Participating' for participating communities and 'Listed' for the rest", () => {
    const { communities } = renderDirectory();

    expect(within(cardFor("Unicorn Mafia")).getByText("Participating")).toBeInTheDocument();
    expect(within(cardFor("Kickstart Global")).getByText("Participating")).toBeInTheDocument();

    for (const c of communities) {
      const expected = c.status === "participating" ? "Participating" : "Listed";
      const card = cardFor(c.name);
      expect(within(card).getByText(expected)).toBeInTheDocument();
      expect(within(card).queryByText(expected === "Listed" ? "Participating" : "Listed")).not.toBeInTheDocument();
    }

    expect(screen.getAllByText("Participating")).toHaveLength(2);
    expect(screen.getAllByText("Listed")).toHaveLength(10);
  });

  it("shows 'No description provided.' for a null description", () => {
    const { communities } = renderDirectory();
    expect(communities.every((c) => c.description === null)).toBe(true);
    expect(within(cardFor("Unicorn Mafia")).getByText("No description provided.")).toBeInTheDocument();
  });

  it("filtering by 'kick' leaves Kickstart Global only, with an 'x of 12' count", async () => {
    const { user } = renderDirectory();
    await user.type(screen.getByLabelText("Search by name or focus"), "kick");

    expect(screen.getByRole("heading", { name: "Kickstart Global" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Unicorn Mafia" })).not.toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "View community" })).toHaveLength(1);
    expect(screen.getByText("1 of 12 communities")).toBeInTheDocument();
  });

  it("opens the Unicorn Mafia panel with its linkedin URL and the no-circles line", async () => {
    const { user } = renderDirectory();
    await user.click(within(cardFor("Unicorn Mafia")).getByRole("button", { name: "View community" }));

    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText("Unicorn Mafia")).toBeInTheDocument();
    expect(within(dialog).getByText("Participating")).toBeInTheDocument();

    const link = within(dialog).getByRole("link");
    expect(link.getAttribute("href")).toBe(UNICORN_URL);

    expect(within(dialog).getByText("No circles listed for this community.")).toBeInTheDocument();
    expect(within(dialog).getByText("No description provided.")).toBeInTheDocument();
    expect(within(dialog).getByText("22 Oct 2026")).toBeInTheDocument();
  });

  it("each panel link equals that community's publicUrl", async () => {
    const { user, communities } = renderDirectory();
    for (const c of communities) {
      await user.click(within(cardFor(c.name)).getByRole("button", { name: "View community" }));
      const dialog = await screen.findByRole("dialog");
      expect(within(dialog).getByRole("link").getAttribute("href")).toBe(c.publicUrl);
      await user.keyboard("{Escape}");
      await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    }
  });
});

describe("communities helpers", () => {
  const { communities } = bootstrap();

  it("filterCommunities: blank returns all, name match is case-insensitive, no match is empty", () => {
    expect(filterCommunities(communities, "")).toHaveLength(12);
    expect(filterCommunities(communities, "   ")).toHaveLength(12);
    expect(filterCommunities(communities, "KICK").map((c) => c.name)).toEqual(["Kickstart Global"]);
    expect(filterCommunities(communities, "zzzz-no-such")).toEqual([]);
  });

  it("filterCommunities matches focus tags", () => {
    const tagged = communities.map((c, i) => (i === 0 ? { ...c, focusTags: ["Robotics"] } : c));
    expect(filterCommunities(tagged, "robot").map((c) => c.id)).toEqual([communities[0].id]);
  });

  it("statusLabel", () => {
    expect(statusLabel("participating")).toBe("Participating");
    expect(statusLabel("connected")).toBe("Connected");
    expect(statusLabel("listed")).toBe("Listed");
  });

  it("formatVerifiedDate", () => {
    expect(formatVerifiedDate("2026-10-22T00:00:00Z")).toBe("22 Oct 2026");
  });
});
