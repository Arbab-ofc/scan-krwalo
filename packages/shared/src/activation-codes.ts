import { createHash, randomInt } from "node:crypto";

export type ActivationCodeType = "SCANNER" | "CLIENT";

export function activationPrefix(type: ActivationCodeType): "SCN" | "CLI" {
  return type === "SCANNER" ? "SCN" : "CLI";
}

export function generateActivationCode(type: ActivationCodeType): string {
  let digits = "";
  while (digits.length < 9) {
    digits += randomInt(0, 10).toString();
  }
  return `${activationPrefix(type)}${digits}`;
}

export function normalizeActivationCode(code: string): string {
  return code.trim().toUpperCase();
}

export function validateActivationCodeFormat(code: string, type?: ActivationCodeType): boolean {
  const normalized = normalizeActivationCode(code);
  const pattern = type === "SCANNER" ? /^SCN\d{9}$/ : type === "CLIENT" ? /^CLI\d{9}$/ : /^(SCN|CLI)\d{9}$/;
  return pattern.test(normalized);
}

export function hashActivationCode(code: string, secret: string): string {
  return createHash("sha256").update(`${secret}:${normalizeActivationCode(code)}`).digest("hex");
}

export function maskActivationCode(code: string): string {
  const normalized = normalizeActivationCode(code);
  return `${normalized.slice(0, 3)}*****${normalized.slice(-4)}`;
}
