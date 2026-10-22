// @vitest-environment happy-dom
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { DiscoverView } from "@/components/discovery/DiscoverView";
import type { DiscoverResponse } from "@/shared/contracts";
import {
  PEOPLE,
  bootstrap,
  discoverResponse,
  failResult,
  okResult,
  type RunDiscover,
} from "./fixtures";

const GOAL = "I want to build warehouse robotics";

const AMARA_EXCERPT = "I spent two years deploying robotics in fulfilment centres";
const AMARA_CAVEAT = "Current availability needs confirmation.";

function mockRun(response: DiscoverResponse = discoverResponse()) {
  return vi.fn<RunDiscover>().mockResolvedValue(okResult(response));
}

async function search(run: RunDiscover, goal = GOAL) {
  const user = userEvent.setup();
  render(<DiscoverView bootstrap={bootstrap()} runDiscover={run} />);
  await user.type(screen.getByLabelText("What do you want to build?"), goal);
  await user.click(screen.getByRole("button", { name: "Find people" }));
  return user;
}

/** Nearest ancestor of the person's name that owns a "Why this person?" button = that person's card. */
function cardFor(name: string): HTMLElement {
  let el: HTMLElement | null = screen.getByText(name);
  while (el) {
    if (within(el).queryAllByRole("button", { name: "Why this person?" }).length > 0) return el;
    el = el.parentElement;
  }
  throw new Error(`No card with a "Why this person?" button found for ${name}`);
}

async function findReady() {
  return screen.findByRole("heading", { name: "3 people for this goal" });
}

describe("ready state (mock sample)", () => {
  it("renders the three people, no community-fit section, community names from bootstrap", async () => {
    const run = mockRun();
    await search(run);
    await findReady();

    for (const name of PEOPLE) expect(screen.getByText(name)).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Why this person?" })).toHaveLength(3);

    // sample communities is [] -> the section must not be invented
    expect(screen.queryByText(/communities that fit/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/community fit/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: /communit(y|ies).*fit/i })).not.toBeInTheDocument();

    // community names are resolved from bootstrap, not raw ids
    expect(within(cardFor("Amara Okafor")).getByText(/Unicorn Mafia/)).toBeInTheDocument();
    expect(within(cardFor("Leo Martin")).getByText(/Kickstart Global/)).toBeInTheDocument();
    expect(within(cardFor("Nina Shah")).getByText(/Kickstart Global/)).toBeInTheDocument();
    expect(document.body.textContent).not.toContain("kickstart-global");
    expect(document.body.textContent).not.toContain("unicorn-mafia");
  });

  it("shows the fit labels on the cards", async () => {
    await search(mockRun());
    await findReady();
    expect(within(cardFor("Amara Okafor")).getByText("Relevant experience")).toBeInTheDocument();
    expect(within(cardFor("Leo Martin")).getByText("Complementary need")).toBeInTheDocument();
    expect(within(cardFor("Nina Shah")).getByText("Potential collaborator")).toBeInTheDocument();
  });

  it("calls runDiscover with the trimmed goal, allowed communities and connections mode", async () => {
    const run = mockRun();
    await search(run, `  ${GOAL}  `);
    await findReady();
    expect(run).toHaveBeenCalledTimes(1);
    expect(run).toHaveBeenCalledWith({
      goal: GOAL,
      communityIds: bootstrap().allowedCommunityIds,
      mode: "connections",
    });
  });
});

describe("Why this person? drawer", () => {
  it("hides evidence until opened, shows it in the dialog, closes on Escape", async () => {
    const user = await search(mockRun());
    await findReady();

    // not on the cards
    expect(document.body.textContent).not.toContain(AMARA_EXCERPT);
    expect(document.body.textContent).not.toContain(AMARA_CAVEAT);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    await user.click(within(cardFor("Amara Okafor")).getByRole("button", { name: "Why this person?" }));

    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText(new RegExp(AMARA_EXCERPT))).toBeInTheDocument();
    expect(within(dialog).getByText(AMARA_CAVEAT)).toBeInTheDocument();
    expect(within(dialog).getByText(/Availability: unknown/)).toBeInTheDocument();
    expect(within(dialog).getByText(/21 Oct 2026/)).toBeInTheDocument();
    expect(within(dialog).getByText(/Fictional contributed statement/)).toBeInTheDocument();

    // other people's evidence is not mixed in
    expect(within(dialog).queryByText(/automating picking/)).not.toBeInTheDocument();

    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());

    // and it is gone from the DOM again
    expect(document.body.textContent).not.toContain(AMARA_EXCERPT);
    expect(document.body.textContent).not.toContain(AMARA_CAVEAT);
  });

  it("shows 'date unknown' when the evidence has no date", async () => {
    const response = discoverResponse();
    response.people[0].evidence[0].occurredAt = null;
    const user = await search(mockRun(response));
    await findReady();

    await user.click(within(cardFor("Amara Okafor")).getByRole("button", { name: "Why this person?" }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText(/date unknown/)).toBeInTheDocument();
  });
});

describe("Bring us together handoff", () => {
  it("links exactly to /circles/new?searchId=demo-search-robotics, with no names or JSON in the URL", async () => {
    await search(mockRun());
    await findReady();

    const link = screen.getByRole("link", { name: "Bring us together" });
    expect(link.getAttribute("href")).toBe("/circles/new?searchId=demo-search-robotics");

    const decoded = decodeURIComponent(link.getAttribute("href") ?? "");
    for (const name of PEOPLE) {
      expect(decoded).not.toContain(name);
      expect(decoded).not.toContain(name.split(" ")[0]);
    }
    expect(decoded).not.toMatch(/[{}[\]"]/);
    expect(decoded).not.toContain("circleDraft");
  });

  it("has no 'Bring us together' link when circleDraft is null", async () => {
    const response = discoverResponse();
    response.circleDraft = null;
    await search(mockRun(response));
    await findReady();

    for (const name of PEOPLE) expect(screen.getByText(name)).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Bring us together" })).not.toBeInTheDocument();
    expect(screen.queryByText("Bring us together")).not.toBeInTheDocument();
    expect(document.querySelector('a[href^="/circles/new"]')).toBeNull();
  });
});

describe("empty state", () => {
  function emptyResponse(keepDraft: boolean): DiscoverResponse {
    const response = discoverResponse();
    response.status = "empty";
    response.people = [];
    response.communities = [];
    response.message = null;
    if (!keepDraft) response.circleDraft = null;
    return response;
  }

  it.each([
    ["no draft", false],
    ["a stale draft still present", true],
  ])("renders the honest empty state without a circle link (%s)", async (_label, keepDraft) => {
    await search(mockRun(emptyResponse(keepDraft)), "something nobody matches");

    const status = await screen.findByRole("status");
    expect(within(status).getByText("No one matched this goal yet.")).toBeInTheDocument();
    expect(within(status).getByRole("link", { name: "Browse communities" }).getAttribute("href")).toBe(
      "/communities",
    );

    expect(screen.queryByRole("link", { name: "Bring us together" })).not.toBeInTheDocument();
    expect(document.querySelector('a[href^="/circles/new"]')).toBeNull();
    expect(screen.queryByRole("heading", { name: /people for this goal/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Why this person?" })).not.toBeInTheDocument();
    for (const name of PEOPLE) expect(screen.queryByText(name)).not.toBeInTheDocument();
  });
});

describe("error state", () => {
  const message = "Search provider is unavailable (test, verbatim).";

  it("shows the error message verbatim with Retry when retryable, and no people", async () => {
    const run = vi
      .fn<RunDiscover>()
      .mockResolvedValue(failResult({ code: "PROVIDER_UNAVAILABLE", message, retryable: true }));
    await search(run);

    const alert = await screen.findByRole("alert");
    expect(within(alert).getByText(message)).toBeInTheDocument();
    expect(within(alert).getByRole("button", { name: "Retry" })).toBeInTheDocument();

    for (const name of PEOPLE) expect(screen.queryByText(name)).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: /people for this goal/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Bring us together" })).not.toBeInTheDocument();
  });

  it("does not show Retry when the error is not retryable", async () => {
    const run = vi
      .fn<RunDiscover>()
      .mockResolvedValue(failResult({ code: "BAD_INPUT", message: "Goal is too vague.", retryable: false }));
    await search(run);

    const alert = await screen.findByRole("alert");
    expect(within(alert).getByText("Goal is too vague.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Retry" })).not.toBeInTheDocument();
    for (const name of PEOPLE) expect(screen.queryByText(name)).not.toBeInTheDocument();
  });

  it("Retry runs the search again and can recover", async () => {
    const run = vi
      .fn<RunDiscover>()
      .mockResolvedValueOnce(failResult({ code: "PROVIDER_UNAVAILABLE", message, retryable: true }))
      .mockResolvedValueOnce(okResult());
    const user = await search(run);

    await user.click(await screen.findByRole("button", { name: "Retry" }));
    await findReady();
    expect(run).toHaveBeenCalledTimes(2);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});

describe("empty goal", () => {
  it("does not call runDiscover for an empty or whitespace-only goal", async () => {
    const run = mockRun();
    const user = userEvent.setup();
    render(<DiscoverView bootstrap={bootstrap()} runDiscover={run} />);

    await user.click(screen.getByRole("button", { name: "Find people" }));
    expect(run).not.toHaveBeenCalled();

    await user.type(screen.getByLabelText("What do you want to build?"), "   ");
    await user.click(screen.getByRole("button", { name: "Find people" }));
    expect(run).not.toHaveBeenCalled();

    expect(screen.queryByRole("heading", { name: /people for this goal/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    for (const name of PEOPLE) expect(screen.queryByText(name)).not.toBeInTheDocument();
  });

  it("does not call runDiscover on Enter in an empty field either", async () => {
    const run = mockRun();
    const user = userEvent.setup();
    render(<DiscoverView bootstrap={bootstrap()} runDiscover={run} />);
    await user.click(screen.getByLabelText("What do you want to build?"));
    await user.keyboard("{Enter}");
    expect(run).not.toHaveBeenCalled();
  });
});
