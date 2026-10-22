// Keep this decoder independent of transport so attribution/filtering can be tested without WhatsApp.
type Raw = {
  key?: {
    remoteJid?: string | null;
    id?: string | null;
    participant?: string | null;
    fromMe?: boolean | null;
  };
  pushName?: string | null;
  messageTimestamp?: unknown;
  message?: {
    conversation?: string | null;
    extendedTextMessage?: {
      text?: string | null;
      contextInfo?: {
        isForwarded?: boolean | null;
        forwardingScore?: number | null;
        quotedMessage?: unknown;
      } | null;
    } | null;
  } | null;
};
export function selectedText(
  m: Raw,
  selected: ReadonlySet<string>,
  ownId?: string,
) {
  const groupId = m.key?.remoteJid;
  if (!groupId?.endsWith("@g.us") || !selected.has(groupId) || !m.key?.id)
    return null;
  const extended = m.message?.extendedTextMessage,
    context = extended?.contextInfo;
  if (
    context?.isForwarded ||
    context?.forwardingScore ||
    context?.quotedMessage
  )
    return null;
  const text = m.message?.conversation ?? extended?.text;
  const senderId = m.key.fromMe ? ownId : m.key.participant;
  if (!text?.trim() || !senderId) return null;
  const seconds = Number(m.messageTimestamp);
  const occurredAt =
    Number.isFinite(seconds) && seconds > 0 && seconds < 8640000000000
      ? new Date(seconds * 1000).toISOString()
      : null;
  return {
    groupId,
    messageId: m.key.id,
    senderId,
    displayName: m.pushName?.slice(0, 200) || "WhatsApp member",
    text: text.trim().slice(0, 16000),
    occurredAt,
  };
}
