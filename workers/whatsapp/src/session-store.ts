import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import {
  mkdir,
  readFile,
  readdir,
  rename,
  rm,
  writeFile,
} from "node:fs/promises";
import { join } from "node:path";
export class EncryptedSessionStore {
  constructor(
    private root: string,
    private key: Buffer,
  ) {
    if (key.length !== 32)
      throw new Error("Session encryption key must contain 32 bytes");
  }
  private file(id: string) {
    if (!/^[a-zA-Z0-9_-]{1,100}$/.test(id))
      throw new Error("Invalid session identifier");
    return join(this.root, `${id}.enc`);
  }
  child(id: string) {
    this.file(id);
    return new EncryptedSessionStore(join(this.root, id), this.key);
  }
  async list(): Promise<string[]> {
    try {
      return (await readdir(this.root))
        .filter((f) => /^[a-zA-Z0-9_-]+\.enc$/.test(f))
        .map((f) => f.slice(0, -4))
        .sort();
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === "ENOENT") return [];
      throw e;
    }
  }
  async read(id: string): Promise<string | null> {
    let data: Buffer;
    try {
      data = await readFile(this.file(id));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
      throw error;
    }
    if (data.length < 29 || data[0] !== 1)
      throw new Error("Invalid encrypted session");
    const decipher = createDecipheriv(
      "aes-256-gcm",
      this.key,
      data.subarray(1, 13),
    );
    decipher.setAAD(Buffer.from(id));
    decipher.setAuthTag(data.subarray(13, 29));
    return Buffer.concat([
      decipher.update(data.subarray(29)),
      decipher.final(),
    ]).toString("utf8");
  }
  async write(id: string, plain: string) {
    const file = this.file(id);
    await mkdir(this.root, { recursive: true, mode: 0o700 });
    const iv = randomBytes(12),
      cipher = createCipheriv("aes-256-gcm", this.key, iv);
    cipher.setAAD(Buffer.from(id));
    const data = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
    const temp = `${file}.${randomBytes(8).toString("hex")}.tmp`;
    try {
      await writeFile(
        temp,
        Buffer.concat([Buffer.from([1]), iv, cipher.getAuthTag(), data]),
        { mode: 0o600 },
      );
      await rename(temp, file);
    } finally {
      await rm(temp, { force: true });
    }
  }
  async remove(id: string) {
    await rm(this.file(id), { force: true });
  }
}
export async function logoutAndErase(
  store: EncryptedSessionStore,
  id: string,
  logout: () => Promise<void>,
) {
  await logout();
  await store.remove(id);
}
