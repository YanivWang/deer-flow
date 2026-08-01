import { v4 as uuidv4 } from "uuid";

export function createId(): string {
  const cryptoApi = globalThis.crypto as Crypto | undefined;
  const randomUUID = (cryptoApi as { randomUUID?: () => string } | undefined)?.randomUUID;
  if (typeof randomUUID === "function") {
    return randomUUID.call(cryptoApi);
  }

  const getRandomValues = (cryptoApi as { getRandomValues?: Crypto["getRandomValues"] } | undefined)
    ?.getRandomValues;
  if (typeof getRandomValues === "function") {
    return uuidv4();
  }

  const random = new Uint8Array(Array.from({ length: 16 }, () => Math.floor(Math.random() * 256)));
  return uuidv4({ random });
}
