import { it, expect } from "vitest";
import { selectedText } from "../../../workers/whatsapp/src/ingest";
it("rejects unselected groups, forwarded messages and quoted replies before ingestion", () => {
  const message = {
    key: { remoteJid: "one@g.us", id: "id", participant: "sender@lid" },
    pushName: "Alex",
    messageTimestamp: 1792700000,
    message: { conversation: "I'm building a robot" },
  };
  expect(selectedText(message, new Set(["two@g.us"]))).toBeNull();
  expect(selectedText(message, new Set(["one@g.us"]))).toMatchObject({
    senderId: "sender@lid",
    text: "I'm building a robot",
    occurredAt: "2026-10-22T20:13:20.000Z",
  });
  expect(
    selectedText(
      {
        ...message,
        message: {
          extendedTextMessage: {
            text: "I can help",
            contextInfo: { isForwarded: true },
          },
        },
      },
      new Set(["one@g.us"]),
    ),
  ).toBeNull();
  expect(
    selectedText(
      {
        ...message,
        message: {
          extendedTextMessage: {
            text: "Yes",
            contextInfo: { quotedMessage: { conversation: "I built robots" } },
          },
        },
      },
      new Set(["one@g.us"]),
    ),
  ).toBeNull();
});
