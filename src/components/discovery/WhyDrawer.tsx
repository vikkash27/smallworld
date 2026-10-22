"use client";

import { useEffect, useRef } from "react";
import type { PersonRecommendation } from "@/shared/contracts";
import { fitLabel, formatEvidenceDate } from "./labels";

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

const SECTION_LABEL = {
  margin: 0,
  fontSize: 13,
  fontWeight: 600,
  color: "#55555D",
  textTransform: "uppercase",
  letterSpacing: "0.06em",
} as const;

export function WhyDrawer(props: {
  person: PersonRecommendation;
  communityNames: string;
  onClose: () => void;
}) {
  const { person, communityNames, onClose } = props;
  const panelRef = useRef<HTMLElement | null>(null);
  const closeRef = useRef<HTMLButtonElement | null>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  // Move focus in on open, return it to the opener on close.
  useEffect(() => {
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    closeRef.current?.focus();
    return () => {
      if (opener && opener.isConnected) opener.focus();
    };
  }, []);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        onCloseRef.current();
        return;
      }
      if (e.key === "Tab" && panelRef.current) {
        const items = Array.from(panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE));
        if (items.length === 0) return;
        const first = items[0];
        const last = items[items.length - 1];
        const active = document.activeElement;
        if (e.shiftKey && (active === first || !panelRef.current.contains(active))) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && (active === last || !panelRef.current.contains(active))) {
          e.preventDefault();
          first.focus();
        }
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  const fit = fitLabel(person.fitType);
  const heading = communityNames ? `${fit} · ${communityNames}` : fit;

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 20, display: "flex", justifyContent: "flex-end" }}>
      <button
        type="button"
        aria-label="Close"
        tabIndex={-1}
        onClick={onClose}
        style={{ position: "absolute", inset: 0, border: 0, background: "rgba(17,17,19,0.4)", cursor: "pointer" }}
      />
      <aside
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="why-title"
        style={{
          position: "relative",
          width: "min(100%, 480px)",
          height: "100%",
          overflowY: "auto",
          background: "#FFFFFF",
          color: "#111113",
          boxSizing: "border-box",
          padding: "28px 24px 40px",
          display: "flex",
          flexDirection: "column",
          gap: 20,
        }}
      >
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16 }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: "#55555D" }}>{heading}</div>
            <h2 id="why-title" style={{ margin: "4px 0 0", fontSize: 26, letterSpacing: "-0.02em" }}>
              Why {person.member.displayName}?
            </h2>
          </div>
          <button
            ref={closeRef}
            type="button"
            aria-label="Close"
            onClick={onClose}
            style={{
              flex: "none",
              width: 44,
              height: 44,
              borderRadius: 10,
              border: "1px solid #DEDEE5",
              background: "#FFFFFF",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#111113" strokeWidth="2" strokeLinecap="round">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>

        <h3 style={SECTION_LABEL}>Evidence</h3>
        <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 20 }}>
          {person.evidence.map((e) => (
            <li
              key={e.id}
              style={{
                border: "1px solid #DEDEE5",
                borderRadius: 12,
                padding: 16,
                display: "flex",
                flexDirection: "column",
                gap: 10,
              }}
            >
              <div style={{ fontWeight: 600, fontSize: 15 }}>{e.summary}</div>
              {e.excerpt !== null ? (
                <blockquote
                  style={{ margin: 0, padding: "10px 14px", background: "#F4F4F7", borderRadius: 8, fontSize: 14, color: "#111113" }}
                >
                  {e.excerpt}
                </blockquote>
              ) : null}
              <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 14px", fontSize: 13, color: "#55555D" }}>
                <span>{e.sourceLabel}</span>
                <span>{formatEvidenceDate(e.occurredAt)}</span>
                <span style={{ fontWeight: 600 }}>{e.evidenceClass}</span>
              </div>
            </li>
          ))}
        </ul>

        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <h3 style={SECTION_LABEL}>Caveats</h3>
          {person.caveats.length > 0 ? (
            <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 8 }}>
              {person.caveats.map((c, i) => (
                <li key={i} style={{ fontSize: 14, color: "#111113" }}>
                  {c}
                </li>
              ))}
            </ul>
          ) : null}
          <p style={{ margin: "4px 0 0", fontSize: 14, color: "#55555D" }}>
            {person.availability === "unknown" ? "Availability: unknown" : "Availability: stated available"}
          </p>
        </div>
      </aside>
    </div>
  );
}
