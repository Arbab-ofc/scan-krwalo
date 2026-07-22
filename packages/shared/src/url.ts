import { createHash } from "node:crypto";

export function normalizeTaskUrl(rawUrl: string, blockedDomains: string[] = []): { normalizedUrl: string; urlHash: string } {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl.trim());
  } catch {
    throw new Error("Invalid URL");
  }
  if (!["http:", "https:"].includes(parsed.protocol)) {
    throw new Error("Unsupported URL scheme");
  }
  parsed.hash = "";
  parsed.hostname = parsed.hostname.toLowerCase();
  if (blockedDomains.some((domain) => parsed.hostname === domain || parsed.hostname.endsWith(`.${domain}`))) {
    throw new Error("Blocked domain");
  }
  const normalizedUrl = parsed.toString();
  return {
    normalizedUrl,
    urlHash: createHash("sha256").update(normalizedUrl).digest("hex")
  };
}
