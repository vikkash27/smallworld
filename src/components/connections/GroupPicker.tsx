"use client";
import { useState } from "react";
import type {
  GroupSummary,
  Selection,
} from "../../../convex/whatsapp/contracts";
import s from "./connections.module.css";
export function GroupPicker({
  groups,
  busy,
  onSave,
}: {
  groups: (GroupSummary & { selected: boolean })[];
  busy: boolean;
  onSave(value: Selection): Promise<void>;
}) {
  const [open, setOpen] = useState(false),
    [query, setQuery] = useState("");
  const [selected, setSelected] = useState(
    () => new Set(groups.filter((g) => g.selected).map((g) => g.id)),
  );
  const [consent, setConsent] = useState(false);
  const visible = groups.filter((g) =>
    g.name.toLocaleLowerCase().includes(query.toLocaleLowerCase()),
  );
  return (
    <section className={s.selection} aria-label="Group selection">
      <h2>Choose where to start.</h2>
      <p>Only the groups you select will be imported into Small World.</p>
      <button
        type="button"
        className={s.pickerButton}
        aria-expanded={open}
        aria-controls="whatsapp-group-options"
        onClick={() => setOpen(!open)}
      >
        Choose groups{" "}
        <span>
          {selected.size ? `${selected.size} selected` : "None selected"}{" "}
          {open ? "−" : "+"}
        </span>
      </button>
      {open && (
        <div id="whatsapp-group-options" className={s.options}>
          <label className={s.searchLabel}>
            Find a group
            <input
              type="search"
              value={query}
              placeholder="Search your groups"
              onChange={(e) => setQuery(e.target.value)}
            />
          </label>
          <div className={s.groupList}>
            {visible.length === 0 && <p>No groups match your search.</p>}
            {visible.map((g) => (
              <label key={g.id} className={s.group}>
                <input
                  type="checkbox"
                  checked={selected.has(g.id)}
                  disabled={busy}
                  onChange={(e) => {
                    const next = new Set(selected);
                    if (e.target.checked) next.add(g.id);
                    else next.delete(g.id);
                    setSelected(next);
                  }}
                />
                <span>
                  {g.name}
                  <small>
                    {g.participantCount === null
                      ? "WhatsApp group"
                      : `${g.participantCount} participants`}
                  </small>
                </span>
              </label>
            ))}
          </div>
        </div>
      )}
      <p className={s.note}>
        Import up to 30 days of available history, capped at 1,000 text messages
        per group and 10,000 in total. New messages sync while connected.
        WhatsApp may provide less history.
      </p>
      <label className={s.consent}>
        <input
          type="checkbox"
          checked={consent}
          disabled={busy}
          onChange={(e) => setConsent(e.target.checked)}
        />
        <span>
          I confirm existing member consent covers importing and using their
          messages in the selected groups.
        </span>
      </label>
      <p className={s.note}>
        Discovery stays within each source group. Names stay hidden on circle
        rosters unless separately permitted.
      </p>
      <button
        className={s.primary}
        type="button"
        disabled={busy || !selected.size || !consent || selected.size > 20}
        onClick={() =>
          void onSave({ groupIds: [...selected], consentRecorded: consent })
        }
      >
        {busy ? "Saving…" : "Start import"}
      </button>
      {selected.size > 20 && (
        <p role="alert">Select at most 20 groups for this connection.</p>
      )}
    </section>
  );
}
