import type { CircleDraft, PersonRecommendation } from "../../../shared/contracts";

const STOPWORDS = new Set([
  "a",
  "an",
  "the",
  "to",
  "with",
  "and",
  "or",
  "of",
  "in",
  "for",
  "on",
  "my",
  "i",
  "me",
  "we",
  "our",
  "want",
  "is",
  "am",
  "are",
]);

const TOPIC_MAX = 80;
const TITLE_MAX = 80;
/** Invitations stay a small group even when the graph shows a wider shortlist. */
const PROPOSED_MEMBERS = 3;

/** Proposal text only. Never claims a person has accepted or will attend. */
export function draftCircle(goal: string, people: PersonRecommendation[]): CircleDraft | null {
  if (people.length === 0) return null;

  const topic = topicFrom(goal);
  if (topic.length === 0) return null;

  const title = `${topic} Circle`.trim().slice(0, TITLE_MAX).trim();

  return {
    title,
    purpose: `Work together on ${topic}. This is a proposal, not a confirmed commitment.`,
    activity: {
      title: "Bring one concrete problem",
      description: `A 30-minute session on ${topic}. Each person brings one real problem or prototype related to the goal. Time to be agreed.`,
      proposedStartsAt: null,
      timezone: "Europe/London",
      location: null,
    },
    proposedMemberIds: people.slice(0, PROPOSED_MEMBERS).map((person) => person.member.id),
    capacity: 6,
    minimumMembers: 3,
  };
}

function topicFrom(goal: string): string {
  const withoutPunctuation = goal.replace(/[^\p{L}\p{N}\s]+/gu, "");
  const words = withoutPunctuation.split(/\s+/).filter((word) => word.length > 0);
  const kept = words.filter((word) => !STOPWORDS.has(word.toLowerCase()));
  return kept.join(" ").slice(0, TOPIC_MAX).trim();
}
