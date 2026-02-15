import { generateKeyPairSync, sign as signData } from "node:crypto";
import { describe, expect, it } from "vitest";
import { verifySourceSignature } from "../src/trust/signature.js";

describe("trust signature verification", () => {
  it("verifies valid ed25519 signature payloads", () => {
    const { publicKey, privateKey } = generateKeyPairSync("ed25519");
    const digest = "sha256:0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
    const signature = signData(null, Buffer.from(digest, "utf8"), privateKey).toString("base64");
    const publicKeyPem = publicKey.export({ type: "spki", format: "pem" }).toString();

    const result = verifySourceSignature({
      digest,
      algorithm: "ed25519",
      keyId: "release-key",
      signature,
      publicKeyPem
    });

    expect(result.ok).toBe(true);
  });

  it("rejects signature mismatch", () => {
    const { publicKey } = generateKeyPairSync("ed25519");
    const digest = "sha256:abcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcd";
    const publicKeyPem = publicKey.export({ type: "spki", format: "pem" }).toString();

    const result = verifySourceSignature({
      digest,
      algorithm: "ed25519",
      keyId: "release-key",
      signature: Buffer.from("bad-signature").toString("base64"),
      publicKeyPem
    });

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error("Expected signature verification to fail");
    }
    expect(result.reason).toMatch(/invalid/i);
  });
});
