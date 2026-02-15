import { verify as verifyData } from "node:crypto";

export type VerifySourceSignatureInput = {
  digest: string;
  algorithm: "ed25519";
  keyId: string;
  signature: string;
  publicKeyPem: string;
};

export type VerifySourceSignatureResult =
  | { ok: true; algorithm: "ed25519"; keyId: string }
  | { ok: false; reason: string };

export function verifySourceSignature(input: VerifySourceSignatureInput): VerifySourceSignatureResult {
  if (!input.digest.startsWith("sha256:")) {
    return { ok: false, reason: "invalid digest format" };
  }
  try {
    const valid = verifyData(
      null,
      Buffer.from(input.digest, "utf8"),
      { key: input.publicKeyPem, format: "pem" },
      Buffer.from(input.signature, "base64")
    );
    if (!valid) return { ok: false, reason: "invalid signature" };
    return { ok: true, algorithm: input.algorithm, keyId: input.keyId };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { ok: false, reason: `signature verification failed: ${message}` };
  }
}
