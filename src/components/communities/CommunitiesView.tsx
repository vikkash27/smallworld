"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { Community } from "@/shared/contracts";
import { CommunityPanel } from "./CommunityPanel";
import { StatusPill } from "./StatusPill";
import { filterCommunities } from "./filter";

export function CommunitiesView({ communities }: { communities: Community[] }) {
  const [query, setQuery] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const openerRef = useRef<HTMLElement | null>(null);

  const visible = filterCommunities(communities, query);
  const selected = openId ? (communities.find((c) => c.id === openId) ?? null) : null;

  // Return focus to the opener once the panel has unmounted.
  useEffect(() => {
    if (openId === null && openerRef.current) {
      const el = openerRef.current;
      openerRef.current = null;
      if (el.isConnected) el.focus();
    }
  }, [openId]);

  return (
    <section aria-labelledby="comm-title">
      <h1 id="comm-title" className="sw-headline">
        Find your community.
      </h1>
      <p className="sw-sub">Start with a community that already exists.</p>
      <Link href="/settings/connections" className="sw-btn sw-btn-brand" style={{ display: "inline-flex", alignItems: "center", marginTop: 20, textDecoration: "none" }}>Connect WhatsApp</Link>

      <div className="mt-10 flex max-w-[560px] flex-col gap-[10px]">
        <label htmlFor="cq" className="sw-label">
          Search by name or focus
        </label>
        <input
          id="cq"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="e.g. Kickstart"
          className="box-border min-h-[52px] rounded-xl border border-solid border-[#DEDEE5] px-4 font-[inherit] text-[#111113]"
        />
      </div>

      <p className="mb-4 mt-6 text-sm text-[#55555D]" aria-live="polite">
        {visible.length} of {communities.length} communities
      </p>

      {visible.length === 0 ? (
        <p className="m-0 text-[15px] text-[#55555D]">No communities match “{query.trim()}”.</p>
      ) : (
        <div className="sw-directory">
          {visible.map((c) => (
            <article key={c.id} className="sw-card flex flex-col gap-3">
              <div className="flex items-start justify-between gap-3">
                <h2 className="m-0 text-lg tracking-[-0.01em]">{c.name}</h2>
                <StatusPill status={c.status} />
              </div>
              <p className="m-0 text-sm text-[#55555D]">{c.description ?? "No description provided."}</p>
              <button
                type="button"
                onClick={(e) => {
                  openerRef.current = e.currentTarget;
                  setOpenId(c.id);
                }}
                className="min-h-11 cursor-pointer self-start rounded-[10px] border border-solid border-[#DEDEE5] bg-white px-4 font-[inherit] text-[15px] font-semibold text-[#111113]"
              >
                View community
              </button>
            </article>
          ))}
        </div>
      )}

      <p className="mb-0 mt-10 text-sm text-[#55555D]">
        Public directory. Member context is available only for participating communities.
      </p>

      {selected && <CommunityPanel community={selected} onClose={() => setOpenId(null)} />}
    </section>
  );
}
