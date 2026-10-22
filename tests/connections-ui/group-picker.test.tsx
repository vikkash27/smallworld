// @vitest-environment happy-dom
import { it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { GroupPicker } from "../../src/components/connections/GroupPicker";
afterEach(cleanup);
it("selects groups by provider id, keeps selection through search and requires the consent declaration", async () => {
  const user = userEvent.setup();
  let submitted: unknown;
  render(
    <GroupPicker
      groups={[
        { id: "one", name: "Robotics", participantCount: 4, selected: false },
        { id: "two", name: "Robotics", participantCount: 8, selected: false },
      ]}
      busy={false}
      onSave={async (value) => {
        submitted = value;
      }}
    />,
  );
  await user.click(screen.getByRole("button", { name: /choose groups/i }));
  const groups = screen.getAllByRole("checkbox", { name: /Robotics/ });
  await user.click(groups[1]);
  await user.type(screen.getByRole("searchbox"), "missing");
  expect(screen.getByText(/no groups match/i)).toBeTruthy();
  expect(
    screen
      .getByRole("button", { name: /start import/i })
      .hasAttribute("disabled"),
  ).toBe(true);
  await user.click(screen.getByRole("checkbox", { name: /consent/i }));
  await user.click(screen.getByRole("button", { name: /start import/i }));
  expect(submitted).toEqual({ groupIds: ["two"], consentRecorded: true });
});
