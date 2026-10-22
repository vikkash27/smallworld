"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { PersonRecommendation } from "@/shared/contracts";
import { fitLabel } from "./labels";

type CommunityNode = { id: string; name: string };

type Edge = {
  key: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  active: boolean;
};

type Column = {
  id: string;
  name: string;
  people: PersonRecommendation[];
};

const CARD_BASE = {
  color: "#FFFFFF",
  borderRadius: 12,
  padding: 20,
  display: "flex",
  flexDirection: "column",
  gap: 12,
  boxSizing: "border-box",
  width: "100%",
  position: "relative",
  zIndex: 1,
} as const;

function sameEdges(current: readonly Edge[], next: readonly Edge[]): boolean {
  if (current.length !== next.length) return false;
  return current.every((edge, index) => {
    const other = next[index];
    return (
      edge.key === other.key &&
      edge.x1 === other.x1 &&
      edge.y1 === other.y1 &&
      edge.x2 === other.x2 &&
      edge.y2 === other.y2 &&
      edge.active === other.active
    );
  });
}

function columnsFor(people: PersonRecommendation[], communities: CommunityNode[]): Column[] {
  const names = new Map(communities.map((community) => [community.id, community.name]));
  const columns = new Map<string, Column>();

  for (const person of people) {
    const primary = person.member.communityIds.find((id) => names.has(id));
    const id = primary ?? "solo";
    const name = primary ? names.get(primary)! : "";
    const column = columns.get(id) ?? { id, name, people: [] };
    column.people.push(person);
    columns.set(id, column);
    for (const communityId of person.member.communityIds) {
      if (communityId === id || !names.has(communityId) || columns.has(communityId)) continue;
      columns.set(communityId, { id: communityId, name: names.get(communityId)!, people: [] });
    }
  }

  return [...columns.values()];
}

export function ResultGraph(props: {
  goal: string;
  people: PersonRecommendation[];
  communities: CommunityNode[];
  onWhy: (person: PersonRecommendation, opener: HTMLElement) => void;
}) {
  const { goal, people, communities, onWhy } = props;
  const columns = useMemo(() => columnsFor(people, communities), [people, communities]);
  const leadId = people[0]?.member.id ?? null;
  const [selectedId, setSelectedId] = useState(leadId);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const nodes = useRef(new Map<string, HTMLElement>());
  const [edges, setEdges] = useState<Edge[]>([]);
  const [stageSize, setStageSize] = useState({ w: 0, h: 0 });

  const bind = useCallback((id: string) => {
    return (element: HTMLElement | null) => {
      if (element) nodes.current.set(id, element);
      else nodes.current.delete(id);
    };
  }, []);

  const measure = useCallback(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const box = stage.getBoundingClientRect();
    if (box.width === 0 || box.height === 0) return;
    const point = (element: HTMLElement) => {
      const rect = element.getBoundingClientRect();
      return {
        x: Math.round(rect.left + rect.width / 2 - box.left),
        y: Math.round(rect.top + rect.height / 2 - box.top),
      };
    };
    const goalNode = nodes.current.get("goal");
    if (!goalNode) return;
    const goalPoint = point(goalNode);
    const selected = people.find((person) => person.member.id === selectedId) ?? null;
    const selectedCommunities = new Set(selected?.member.communityIds ?? []);
    const next: Edge[] = [];

    for (const column of columns) {
      if (!column.name) continue;
      const hub = nodes.current.get(`community:${column.id}`);
      if (!hub) continue;
      const hubPoint = point(hub);
      next.push({
        key: `goal-${column.id}`,
        x1: goalPoint.x,
        y1: goalPoint.y,
        x2: hubPoint.x,
        y2: hubPoint.y,
        active: selectedCommunities.has(column.id),
      });
    }

    for (const person of people) {
      const personNode = nodes.current.get(`person:${person.member.id}`);
      if (!personNode) continue;
      const personPoint = point(personNode);
      const linked = person.member.communityIds.filter((id) => nodes.current.has(`community:${id}`));
      if (linked.length === 0) {
        next.push({
          key: `${person.member.id}-goal`,
          x1: personPoint.x,
          y1: personPoint.y,
          x2: goalPoint.x,
          y2: goalPoint.y,
          active: person.member.id === selectedId,
        });
        continue;
      }
      for (const communityId of linked) {
        const hub = nodes.current.get(`community:${communityId}`);
        if (!hub) continue;
        const hubPoint = point(hub);
        next.push({
          key: `${person.member.id}-${communityId}`,
          x1: personPoint.x,
          y1: personPoint.y,
          x2: hubPoint.x,
          y2: hubPoint.y,
          active: person.member.id === selectedId,
        });
      }
    }

    const width = Math.round(box.width);
    const height = Math.round(box.height);
    setStageSize((current) => (current.w === width && current.h === height ? current : { w: width, h: height }));
    setEdges((current) => (sameEdges(current, next) ? current : next));
  }, [columns, people, selectedId]);

  useLayoutEffect(() => {
    measure();
  }, [measure]);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => measure());
    observer.observe(stage);
    return () => observer.disconnect();
  }, [measure]);

  useEffect(() => {
    setSelectedId(leadId);
  }, [leadId]);

  return (
    <div ref={stageRef} className="sw-graph" aria-label="People linked through shared communities">
      <svg className="sw-graph-svg" width={stageSize.w} height={stageSize.h} aria-hidden="true">
        {edges.map((edge) => (
          <line
            key={edge.key}
            x1={edge.x1}
            y1={edge.y1}
            x2={edge.x2}
            y2={edge.y2}
            className={edge.active ? "is-active" : undefined}
          />
        ))}
      </svg>

      <div ref={bind("goal")} data-graph-node="goal" className="sw-graph-goal">
        {goal}
      </div>

      <div className="sw-graph-columns">
        {columns.map((column) => (
          <div key={column.id} className="sw-graph-col">
            {column.name ? (
              <div
                ref={bind(`community:${column.id}`)}
                data-graph-node="community"
                data-id={column.id}
                className="sw-graph-community"
              >
                {column.name}
              </div>
            ) : null}
            <div className="sw-graph-people">
              {column.people.map((person) => {
                const lead = person.member.id === leadId;
                const selected = person.member.id === selectedId;
                const names = person.member.communityIds
                  .map((id) => communities.find((community) => community.id === id)?.name)
                  .filter((name): name is string => !!name)
                  .join(" · ");
                return (
                  <article
                    key={person.member.id}
                    ref={bind(`person:${person.member.id}`)}
                    data-graph-node="person"
                    data-id={person.member.id}
                    aria-current={selected ? "true" : undefined}
                    onClick={() => setSelectedId(person.member.id)}
                    className={lead ? "sw-card-lead sw-graph-person" : "sw-tile sw-graph-person"}
                    style={{
                      ...CARD_BASE,
                      background: lead ? "#4334F5" : "#18181C",
                      outline: selected ? "2px solid #FFFFFF" : undefined,
                      outlineOffset: selected ? 3 : undefined,
                      cursor: "pointer",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                      <div
                        aria-hidden="true"
                        style={{
                          width: 48,
                          height: 48,
                          borderRadius: "50%",
                          background: "rgba(255,255,255,0.16)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontWeight: 600,
                          flex: "0 0 auto",
                        }}
                      >
                        {person.member.initials}
                      </div>
                      <span
                        style={{
                          fontSize: 13,
                          fontWeight: 600,
                          padding: "4px 10px",
                          borderRadius: 999,
                          background: "rgba(255,255,255,0.16)",
                        }}
                      >
                        {fitLabel(person.fitType)}
                      </span>
                    </div>
                    <div>
                      <h3 style={{ margin: 0, fontSize: 22, letterSpacing: "-0.02em" }}>{person.member.displayName}</h3>
                      {names ? (
                        <p style={{ margin: "2px 0 0", fontSize: 14, color: lead ? "rgba(255,255,255,0.82)" : "#B4B4BC" }}>
                          {names}
                        </p>
                      ) : null}
                    </div>
                    <p style={{ margin: 0, fontSize: 15, flex: "1 1 auto" }}>{person.reason}</p>
                    <button
                      type="button"
                      className="on-brand"
                      aria-haspopup="dialog"
                      onClick={(event) => {
                        event.stopPropagation();
                        setSelectedId(person.member.id);
                        onWhy(person, event.currentTarget);
                      }}
                      style={{
                        alignSelf: "flex-start",
                        minHeight: 44,
                        padding: "0 16px",
                        borderRadius: 10,
                        border: "1px solid rgba(255,255,255,0.5)",
                        background: "transparent",
                        color: "#FFFFFF",
                        font: "inherit",
                        fontWeight: 600,
                        fontSize: 15,
                        cursor: "pointer",
                      }}
                    >
                      Why this person?
                    </button>
                  </article>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
