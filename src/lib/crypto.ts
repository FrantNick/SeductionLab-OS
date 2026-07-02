import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";

/**
 * AES-256-GCM encryption for secrets at rest (integration credentials,
 * AI provider keys, proxy passwords). The key derives from ENCRYPTION_KEY,
 * falling back to AUTH_SECRET so a fresh install works out of the box —
 * production deployments should set a dedicated ENCRYPTION_KEY.
 *
 * Wire format: base64(iv):base64(authTag):base64(ciphertext)
 */

function key(): Buffer {
  const secret = process.env.ENCRYPTION_KEY ?? process.env.AUTH_SECRET;
  if (!secret) throw new Error("ENCRYPTION_KEY or AUTH_SECRET must be set");
  return createHash("sha256").update(secret).digest();
}

export function encryptSecret(plaintext: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("base64")}:${tag.toString("base64")}:${encrypted.toString("base64")}`;
}

export function decryptSecret(payload: string): string {
  const [iv, tag, data] = payload.split(":").map((part) => Buffer.from(part, "base64"));
  const decipher = createDecipheriv("aes-256-gcm", key(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
}

/** Last-4 style hint for displaying stored secrets without revealing them. */
export function secretHint(payload: string | null): string | null {
  if (!payload) return null;
  try {
    const plain = decryptSecret(payload);
    return plain.length <= 4 ? "••••" : `••••${plain.slice(-4)}`;
  } catch {
    return "••••";
  }
}
