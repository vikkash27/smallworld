import {
  BufferJSON,
  initAuthCreds,
  proto,
  type AuthenticationState,
  type SignalDataSet,
  type SignalDataTypeMap,
} from "baileys";
import { EncryptedSessionStore } from "./session-store.js";
export async function encryptedAuth(store: EncryptedSessionStore, id: string) {
  const raw = await store.read(id);
  const saved = raw
    ? JSON.parse(raw, BufferJSON.reviver)
    : { creds: initAuthCreds(), keys: {} };
  let queue: Promise<void> = Promise.resolve();
  const persist = () => {
    const snapshot = JSON.stringify(saved, BufferJSON.replacer);
    const next = queue.then(() => store.write(id, snapshot));
    queue = next.catch(() => undefined);
    return next;
  };
  const state: AuthenticationState = {
    creds: saved.creds,
    keys: {
      get: async <T extends keyof SignalDataTypeMap>(
        type: T,
        ids: string[],
      ) => {
        const result: { [id: string]: SignalDataTypeMap[T] } = {};
        for (const key of ids) {
          let value = saved.keys[type]?.[key];
          if (type === "app-state-sync-key" && value)
            value = proto.Message.AppStateSyncKeyData.fromObject(value);
          if (value) result[key] = value;
        }
        return result;
      },
      set: async (data: SignalDataSet) => {
        for (const [type, keys] of Object.entries(data)) {
          saved.keys[type] ??= {};
          for (const [key, value] of Object.entries(keys)) {
            if (value === null) delete saved.keys[type][key];
            else saved.keys[type][key] = value;
          }
        }
        await persist();
      },
    },
  };
  return { state, save: persist, flush: () => queue };
}
