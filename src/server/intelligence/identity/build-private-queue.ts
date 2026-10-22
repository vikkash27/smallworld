import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { buildIdentityGraph } from "./resolve";

const exportsToRead = process.argv.slice(2).map((pair) => {
  const [chatId, zip] = pair.split("=");
  if (!chatId || !zip) throw new Error("Usage: chatId=/path/to.zip");
  return { chatId, zip };
});
if (exportsToRead.length === 0) throw new Error("Pass chatId=/absolute/path.zip arguments.");

const chats = exportsToRead.map((item) => ({
  chatId: item.chatId,
  text: execFileSync("unzip", ["-p", item.zip, "_chat.txt"], { encoding: "utf8", maxBuffer: 20_000_000 }),
}));

const graph = buildIdentityGraph(chats);
const priority = {
  cards: graph.cards.filter(
    (card) =>
      card.candidates.length > 0 ||
      card.claims.some((claim) => claim.kind === "introduction" || claim.kind === "project") ||
      card.edges.some((edge) => edge.type === "multi_community"),
  ),
};
mkdirSync("private", { recursive: true });
writeFileSync("private/identity-review.json", JSON.stringify(graph, null, 2));
writeFileSync("private/identity-review-priority.json", JSON.stringify(priority, null, 2));

const candidates = graph.cards.flatMap((card) => card.candidates);
console.log(
  JSON.stringify({
    senders: graph.cards.length,
    priority: priority.cards.length,
    selfAttributedLinks: candidates.filter((item) => item.source === "self_shared").length,
    candidates: candidates.length,
    confirmed: candidates.filter((item) => item.status === "confirmed").length,
    unresolved: candidates.filter((item) => item.status === "unresolved").length,
    rejected: candidates.filter((item) => item.status === "rejected").length,
  }),
);
