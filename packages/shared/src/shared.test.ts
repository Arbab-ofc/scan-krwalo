import { describe, expect, it } from "vitest";
import { displayToMinorUnits, generateActivationCode, maskActivationCode, minorUnitsToDisplay, normalizeTelegramUsername, normalizeTaskUrl, validateActivationCodeFormat, canTransitionTask, signupSchema, taskBulkCreateSchema } from "./index.js";

describe("activation codes", () => {
  it("generates SCN and CLI codes with exactly nine digits", () => {
    const scanner = generateActivationCode("SCANNER");
    const client = generateActivationCode("CLIENT");
    expect(scanner).toMatch(/^SCN\d{9}$/);
    expect(client).toMatch(/^CLI\d{9}$/);
    expect(validateActivationCodeFormat(scanner, "SCANNER")).toBe(true);
    expect(maskActivationCode(scanner)).toMatch(/^SCN\*{5}\d{4}$/);
  });
});

describe("telegram", () => {
  it("normalizes usernames and t.me links", () => {
    expect(normalizeTelegramUsername(" @ScanKrwaloAdmin ")).toBe("ScanKrwaloAdmin");
    expect(normalizeTelegramUsername("https://t.me/ScanKrwaloAdmin")).toBe("ScanKrwaloAdmin");
  });
});

describe("signup", () => {
  it("accepts international usernames", () => {
    const parsed = signupSchema.parse({
      username: "扫描员123",
      email: "scanner@example.cn",
      password: "Scanner1234",
      confirmPassword: "Scanner1234",
      role: "SCANNER"
    });
    expect(parsed.username).toBe("扫描员123");
  });

  it("rejects usernames with spaces or punctuation", () => {
    expect(() => signupSchema.parse({
      username: "scan user!",
      email: "scanner@example.cn",
      password: "Scanner1234",
      confirmPassword: "Scanner1234",
      role: "SCANNER"
    })).toThrow();
  });
});

describe("money", () => {
  it("converts display amounts to integer minor units", () => {
    expect(displayToMinorUnits("10.50")).toBe(1050n);
    expect(minorUnitsToDisplay(1050n)).toBe("10.50");
    expect(displayToMinorUnits("0.2")).toBe(20n);
    expect(minorUnitsToDisplay(20n)).toBe("0.20");
  });
});

describe("task URLs", () => {
  it("normalizes http URLs and rejects blocked domains", () => {
    expect(normalizeTaskUrl("HTTPS://Example.COM/a#frag").normalizedUrl).toBe("https://example.com/a");
    expect(() => normalizeTaskUrl("javascript:alert(1)")).toThrow();
    expect(() => normalizeTaskUrl("https://evil.example.com", ["example.com"])).toThrow();
  });

  it("accepts multiple task URLs for bulk posting", () => {
    expect(taskBulkCreateSchema.parse({
      urls: ["https://example.com/one", "https://example.com/two"]
    }).urls).toHaveLength(2);
  });
});

describe("task state machine", () => {
  it("accepts only explicit transitions", () => {
    expect(canTransitionTask("AVAILABLE", "CLAIMED")).toBe(true);
    expect(canTransitionTask("AVAILABLE", "COMPLETED")).toBe(false);
  });
});
