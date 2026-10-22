"use client";

import { useEffect, useRef } from "react";
import type { Community } from "@/shared/contracts";
import { formatVerifiedDate, publicUrlLabel } from "./filter";
import { StatusPill } from "./StatusPill";

const FOCUSABLE = 'a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])';

export function CommunityPanel({ community, onClose }: { community: Community; onClose: () => void }) {
  const dialogRef = useRef<HTMLElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    closeRef.current?.focus();

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.stopPropagation();
        onCloseRef.current();
        return;
      }
      if (e.key !== "Tab" || !dialogRef.current) return;
      const items = Array.from(dialogRef.current.querySelectorAll<HTMLElement>(FOCUSABLE));
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;
      if (e.shiftKey && active === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      } else if (!dialogRef.current.contains(active)) {
        e.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      if (opener && opener !== document.body && document.contains(opener)) opener.focus();
    };
  }, []);

  return (
    <div className="fixed inset-0 z-20 flex justify-end">
      <button
        type="button"
        aria-label="Close"
        tabIndex={-1}
        onClick={onClose}
        className="absolute inset-0 cursor-pointer border-0 bg-[rgba(17,17,19,0.4)]"
      />
      <aside
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="cp-title"
        className="relative box-border flex h-full w-[min(100%,420px)] flex-col gap-[18px] overflow-y-auto bg-white px-6 pb-10 pt-7"
      >
        <div className="flex items-start justify-between gap-4">
          <h2 id="cp-title" className="m-0 text-[26px] tracking-[-0.02em]">
            {community.name}
          </h2>
          <button
            ref={closeRef}
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="flex h-11 w-11 flex-none cursor-pointer items-center justify-center rounded-[10px] border border-solid border-[#DEDEE5] bg-white"
          >
            <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#111113" strokeWidth="2" strokeLinecap="round">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>
        <StatusPill status={community.status} className="self-start" />
        <p className="m-0 text-[15px] text-[#55555D]">{community.description ?? "No description provided."}</p>
        <dl className="m-0 grid grid-cols-[max-content_1fr] gap-x-4 gap-y-[10px] text-[15px]">
          <dt className="text-[#55555D]">How to join</dt>
          <dd className="m-0 min-w-0 break-words">
            <a
              href={community.publicUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-11 items-center"
            >
              {publicUrlLabel(community.publicUrl)}
            </a>
          </dd>
          <dt className="text-[#55555D]">Verified</dt>
          <dd className="m-0">{formatVerifiedDate(community.metadataVerifiedAt)}</dd>
        </dl>
        <div className="border-t border-solid border-[#DEDEE5] pt-4">
          <h3 className="m-0 mb-[6px] text-[13px] font-semibold uppercase tracking-[0.06em] text-[#55555D]">Circles</h3>
          <p className="m-0 text-sm text-[#55555D]">No circles listed for this community.</p>
        </div>
      </aside>
    </div>
  );
}
