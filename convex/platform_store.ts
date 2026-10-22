import type { GenericId } from "convex/values";
import type { Doc, TableNames } from "./_generated/dataModel";
import type { DatabaseReader, DatabaseWriter } from "./_generated/server";
import type {
  GenericDataModel,
  GenericDatabaseReader,
  GenericDatabaseWriter,
} from "convex/server";

export type Row<T extends TableNames> = Omit<Doc<T>, "_id" | "_creationTime">;
export type Scope = { workspaceId: string; dataMode: string };
export interface Store {
  all<T extends TableNames>(table: T, scope?: Scope): Promise<Row<T>[]>;
  get<T extends TableNames>(table: T, id: string): Promise<Row<T> | null>;
  byToken<T extends "invitations" | "contribution_capabilities">(
    table: T,
    hash: string,
  ): Promise<Row<T> | null>;
  circleMembership(
    circleId: string,
    memberId: string,
  ): Promise<Row<"circle_members"> | null>;
  put<T extends TableNames>(table: T, row: Row<T>): Promise<void>;
  remove<T extends TableNames>(table: T, id: string): Promise<void>;
}

function clean<T extends TableNames>(doc: Doc<T>): Row<T> {
  const { _id, _creationTime, ...row } = doc;
  void _id;
  void _creationTime;
  return row;
}

// All tables have a domain-ID index; capability lookup never scans raw tokens.
export function convexStore(database: DatabaseReader | DatabaseWriter): Store {
  // This adapter erases only the generic table-name parameter, which TypeScript
  // cannot narrow across Convex's conditional insert/index types. Public Store
  // methods retain the generated schema types; Convex validates every write.
  const db = database as unknown as GenericDatabaseReader<GenericDataModel> &
    Partial<GenericDatabaseWriter<GenericDataModel>>;
  const lookup = <T extends TableNames>(table: T, id: string) =>
    db
      .query(table)
      .withIndex("by_domain_id", (q) => q.eq("id", id))
      .unique();
  return {
    async all(table, scope) {
      const query = scope
        ? db
            .query(table)
            .withIndex("by_workspace_mode", (q) =>
              q.eq("workspaceId", scope.workspaceId),
            )
            .filter((q) => q.eq(q.field("dataMode"), scope.dataMode))
        : db.query(table);
      return (await query.collect()).map((doc) =>
        clean(doc as Doc<typeof table>),
      );
    },
    async get(table, id) {
      const doc = await lookup(table, id);
      return doc ? clean(doc as Doc<typeof table>) : null;
    },
    async byToken(table, hash) {
      const doc = await db
        .query(table)
        .withIndex("by_token_hash", (q) => q.eq("tokenHash", hash))
        .unique();
      return doc ? clean(doc as Doc<typeof table>) : null;
    },
    async circleMembership(circleId, memberId) {
      const doc = await db
        .query("circle_members")
        .withIndex("by_circle_member", (q) => q.eq("circleId", circleId))
        .filter((q) => q.eq(q.field("memberId"), memberId))
        .unique();
      return doc ? clean(doc as Doc<"circle_members">) : null;
    },
    async put(table, row) {
      if (!db.insert || !db.replace) throw new Error("Query attempted a write");
      const existing = await lookup(table, row.id);
      if (existing) await db.replace(existing._id as GenericId<string>, row);
      else await db.insert(table, row);
    },
    async remove(table, id) {
      if (!db.delete) throw new Error("Query attempted a write");
      const existing = await lookup(table, id);
      if (existing) await db.delete(existing._id as GenericId<string>);
    },
  };
}
