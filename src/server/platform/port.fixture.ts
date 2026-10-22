import type { TableNames } from "../../../convex/_generated/dataModel";
import type { Row, Scope, Store } from "../../../convex/platform_store";
import * as model from "../../../convex/platform_model";
import { resetSample, seedAll } from "../../../convex/seed";
import type {
  ActivityUpdateRequest,
  ContributionRequest,
  CreateCircleRequest,
  InvitationResponseRequest,
  SaveSearchInput,
  Viewer,
} from "@/shared/contracts";
import type { PlatformService } from "./service";

// Copy-on-write transactions provide rollback and serialization for the fixture
// implementation. Production uses one native Convex transaction per operation.
export class MemoryStore implements Store {
  private tables = new Map<TableNames, Map<string, unknown>>();
  clone() {
    const copy = new MemoryStore();
    copy.tables = structuredClone(this.tables);
    return copy;
  }
  async all<T extends TableNames>(table: T, scope?: Scope): Promise<Row<T>[]> {
    const rows = structuredClone([
      ...(this.tables.get(table)?.values() ?? []),
    ]) as Row<T>[];
    return scope
      ? rows.filter(
          (row) =>
            "workspaceId" in row &&
            "dataMode" in row &&
            row.workspaceId === scope.workspaceId &&
            row.dataMode === scope.dataMode,
        )
      : rows;
  }
  async circleMembership(circleId: string, memberId: string) {
    return (
      (await this.all("circle_members")).find(
        (m) => m.circleId === circleId && m.memberId === memberId,
      ) ?? null
    );
  }
  async get<T extends TableNames>(
    table: T,
    id: string,
  ): Promise<Row<T> | null> {
    return structuredClone(
      this.tables.get(table)?.get(id) ?? null,
    ) as Row<T> | null;
  }
  async byToken<T extends "invitations" | "contribution_capabilities">(
    table: T,
    hash: string,
  ): Promise<Row<T> | null> {
    return (
      (await this.all(table)).find((row) => row.tokenHash === hash) ?? null
    );
  }
  async put<T extends TableNames>(table: T, row: Row<T>) {
    if (!this.tables.has(table)) this.tables.set(table, new Map());
    this.tables.get(table)!.set(row.id, structuredClone(row));
  }
  async remove<T extends TableNames>(table: T, id: string) {
    this.tables.get(table)?.delete(id);
  }
}

export class FixturePort implements PlatformService {
  private store = new MemoryStore();
  private queue: Promise<unknown>;
  constructor(contributionTokenHash = "fixture-contribution-token-hash") {
    this.queue = seedAll(this.store, contributionTokenHash);
  }
  private async read<T>(fn: (store: Store) => Promise<T>): Promise<T> {
    await this.queue;
    return fn(this.store);
  }
  private write<T>(fn: (store: Store) => Promise<T>): Promise<T> {
    const pending = this.queue.then(async () => {
      const transaction = this.store.clone();
      const result = await fn(transaction);
      this.store = transaction;
      return result;
    });
    this.queue = pending.catch(() => undefined);
    return pending;
  }
  getWorkspace(id: string) {
    return this.read((s) => s.get("workspaces", id));
  }
  bootstrap(viewer: Viewer) {
    return this.read((s) => model.bootstrap(s, viewer));
  }
  getCommunities(viewer: Viewer) {
    return this.read((s) => model.communities(s, viewer));
  }
  getCandidateContexts(viewer: Viewer, ids: string[]) {
    return this.read((s) => model.contexts(s, viewer, ids));
  }
  saveSearch(viewer: Viewer, input: SaveSearchInput) {
    return this.write((s) => model.saveSearch(s, viewer, input));
  }
  readSearch(viewer: Viewer, id: string, now = Date.now()) {
    return this.read((s) => model.readSearch(s, viewer, id, now));
  }
  createCircle(
    viewer: Viewer,
    input: CreateCircleRequest,
    tokens: model.InvitationToken[],
  ) {
    return this.write((s) => model.createCircle(s, viewer, input, tokens));
  }
  listCircles(viewer: Viewer) {
    return this.read((s) => model.listCircles(s, viewer));
  }
  circleDetail(viewer: Viewer, id: string) {
    return this.read((s) => model.circleDetail(s, viewer, id));
  }
  updateActivity(viewer: Viewer, id: string, input: ActivityUpdateRequest) {
    return this.write((s) => model.updateActivity(s, viewer, id, input));
  }
  invitationView(hash: string, now: number) {
    return this.read((s) => model.invitationView(s, hash, now));
  }
  respond(hash: string, input: InvitationResponseRequest) {
    return this.write((s) => model.respond(s, hash, input));
  }
  contribute(input: ContributionRequest, hash: string) {
    return this.write((s) => model.contribute(s, input, hash));
  }
  reset(viewer: Viewer) {
    return this.write((s) => resetSample(s, viewer));
  }
}

export function createFixturePort(): FixturePort {
  return new FixturePort();
}
export const fixturePort = createFixturePort();
