import { describe, expect, it } from "vitest";
import { generateActivationCode, validateActivationCodeFormat } from "@scan-krwalo/shared";

describe("activation code generator contract", () => {
  it("never produces public admin codes", () => {
    for (let index = 0; index < 25; index++) {
      expect(validateActivationCodeFormat(generateActivationCode("SCANNER"), "SCANNER")).toBe(true);
      expect(validateActivationCodeFormat(generateActivationCode("CLIENT"), "CLIENT")).toBe(true);
    }
  });
});
