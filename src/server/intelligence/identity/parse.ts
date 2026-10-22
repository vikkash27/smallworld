import { createHash } from "node:crypto";
import type { MessageAttribution, ParsedMessage } from "./types";

const MARKS = /[\u200e\u200f\u202a\u202b\u202c\u202d\u202e]/g;
const MESSAGE_LINE =
  /^\[(\d{1,2})\/(\d{1,2})\/(\d{2,4}),\s+(\d{1,2}):(\d{2})(?::(\d{2}))?\]\s([^:]+):\s(.*)$/;

const SYSTEM =
  /end-to-end encrypted|created this group|created group|added you|joined using|left$|changed the subject|changed this group|removed |changed their phone|you deleted this message|this message was deleted|missed (voice|video) call|<media omitted>|image omitted|video omitted|audio omitted|sticker omitted|gif omitted|document omitted/i;

export interface ChatExport {
  chatId: string;
  text: string;
}

/** Day-first dates. These exports are Europe/London WhatsApp transcripts. */
export function parseChatExport(chat: ChatExport): ParsedMessage[] {
  const messages: ParsedMessage[] = [];
  let current: ParsedMessage | null = null;

  for (const rawLine of chat.text.split(/\r?\n/)) {
    const line = rawLine.replace(MARKS, "");
    const match = MESSAGE_LINE.exec(line);
    if (!match) {
      if (current && line.trim()) current.body = `${current.body}\n${line.trim()}`;
      continue;
    }
    if (current) messages.push(finish(current));
    const sender = cleanSender(match[7] ?? "");
    const body = (match[8] ?? "").trim();
    const key = senderKey(chat.chatId, sender);
    current = {
      messageId: "",
      chatId: chat.chatId,
      occurredAt: toIso(match[1] ?? "", match[2] ?? "", match[3] ?? "", match[4] ?? "", match[5] ?? "", match[6]),
      senderKey: key,
      label: senderLabel(sender),
      body,
      attribution: "own",
    };
  }
  if (current) messages.push(finish(current));

  return messages.filter((message) => message.body.length > 0 && !SYSTEM.test(message.body));
}

/**
 * A leading + is an explicit international number. Local numbers are kept as
 * written. A missing country code is never guessed, so 07700… does not match +447700….
 */
export function senderKey(chatId: string, sender: string): string {
  const phone = phoneIdentity(sender);
  if (phone) return `phone:${sha(phone).slice(0, 16)}`;
  return `name:${chatId}:${sha(sender.toLowerCase()).slice(0, 16)}`;
}

export function isPhoneSender(sender: string): boolean {
  return phoneIdentity(sender) !== null;
}

function cleanSender(sender: string): string {
  return sender.replace(MARKS, "").replace(/^~\s*/, "").trim();
}

function senderLabel(sender: string): string {
  const phone = phoneIdentity(sender);
  if (!phone) return sender;
  return `Unsaved contact ${sha(phone).slice(0, 4)}`;
}

function phoneIdentity(sender: string): string | null {
  const compact = sender.replace(/[\s().-]/g, "");
  if (/^\+\d{8,15}$/.test(compact)) return compact;
  if (/^\d{8,15}$/.test(compact)) return compact;
  return null;
}

function finish(message: ParsedMessage): ParsedMessage {
  const attribution = classify(message.body);
  return {
    ...message,
    attribution,
    messageId: sha(`${message.chatId}|${message.senderKey}|${message.occurredAt ?? ""}|${message.body}`).slice(0, 20),
  };
}

export function classify(body: string): MessageAttribution {
  if (/forwarded message|^\s*forwarded\b/i.test(body)) return "forwarded";
  if (/\b(we are hiring|we're hiring|we’re hiring|job opening|apply at|apply here)\b/i.test(body) && !/\b(i am|i'm|i’m)\b/i.test(body)) {
    return "job_advert";
  }
  if (/\b([A-Z][a-z]+(?:'s|’s)|his|her|their)\s+(linkedin|github|profile)\b/.test(body) && !/\bmy (linkedin|github|profile)\b/i.test(body)) {
    return "about_other";
  }
  return "own";
}

function sha(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function toIso(
  day: string,
  month: string,
  year: string,
  hour: string,
  minute: string,
  second: string | undefined,
): string | null {
  const y = year.length === 2 ? `20${year}` : year;
  const dd = day.padStart(2, "0");
  const mm = month.padStart(2, "0");
  const date = new Date(`${y}-${mm}-${dd}T${hour.padStart(2, "0")}:${minute}:${(second ?? "00").padStart(2, "0")}Z`);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}
