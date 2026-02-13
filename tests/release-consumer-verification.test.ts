import { createHash, generateKeyPairSync } from "node:crypto";
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { afterEach, describe, expect, it } from "vitest";

const tempDirs: string[] = [];

function makeTempDir(prefix: string): string {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  tempDirs.push(dir);
  return dir;
}

function runCli(
  args: string[],
  cwd: string,
  envOverrides?: Record<string, string>
): { status: number; stdout: string; stderr: string } {
  const rootDir = process.cwd();
  const result = spawnSync(join(rootDir, "node_modules", ".bin", "tsx"), [join(rootDir, "src", "cli.ts"), ...args], {
    cwd,
    encoding: "utf8",
    env: envOverrides ? { ...process.env, ...envOverrides } : process.env
  });
  return {
    status: result.status ?? 1,
    stdout: result.stdout,
    stderr: result.stderr
  };
}

function sha256FileHex(path: string): string {
  const hash = createHash("sha256");
  hash.update(readFileSync(path));
  return hash.digest("hex");
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe("release consumer verification script", () => {
  const maybeIt = process.platform === "win32" ? it.skip : it;

  maybeIt("verifies checksum + signature artifacts in offline mode", () => {
    const projectDir = makeTempDir("skillbase-release-consumer-verify-");
    mkdirSync(join(projectDir, "skills", "safe"), { recursive: true });
    writeFileSync(
      join(projectDir, "skills", "safe", "SKILL.md"),
      `---\nname: safe\ndescription: safe skill\n---\n\n# Safe\n`,
      "utf8"
    );
    writeFileSync(
      join(projectDir, "skillbase.yml"),
      `version: 1\nskillsets:\n  base:\n    skills:\n      - source: local:./skills\napply:\n  useSkillsets: [base]\n`,
      "utf8"
    );

    const keyPair = generateKeyPairSync("ed25519");
    const privateKeyPath = join(projectDir, "bundle-private.pem");
    const publicKeyPath = join(projectDir, "bundle-public.pem");
    writeFileSync(privateKeyPath, keyPair.privateKey.export({ format: "pem", type: "pkcs8" }).toString(), "utf8");
    writeFileSync(publicKeyPath, keyPair.publicKey.export({ format: "pem", type: "spki" }).toString(), "utf8");

    expect(runCli(["update"], projectDir).status).toBe(0);

    const bundlePath = join(projectDir, "skillbase-release.zip");
    const exported = runCli(
      ["export", "--out", bundlePath, "--sign-private-key", privateKeyPath, "--deterministic", "--json"],
      projectDir,
      { SOURCE_DATE_EPOCH: "1704067200" }
    );
    expect(exported.status).toBe(0);
    expect(existsSync(bundlePath)).toBe(true);

    const verifyJsonPath = join(projectDir, "skillbase-release.verify.json");
    const verify = runCli(
      ["verify-bundle", "--bundle", bundlePath, "--sign-public-key", publicKeyPath, "--require-signature", "--json"],
      projectDir
    );
    expect(verify.status).toBe(0);
    writeFileSync(verifyJsonPath, verify.stdout, "utf8");

    const checksumPath = join(projectDir, "SHA256SUMS");
    const checksumHex = sha256FileHex(bundlePath);
    writeFileSync(checksumPath, `${checksumHex}  ${join(projectDir, "skillbase-release.zip")}\n`, "utf8");

    const scriptPath = join(process.cwd(), "scripts", "verify_release_consumer_artifact.sh");
    const result = spawnSync(
      "bash",
      [
        scriptPath,
        "--artifact",
        bundlePath,
        "--checksums",
        checksumPath,
        "--verify-json",
        verifyJsonPath,
        "--public-key",
        publicKeyPath,
        "--skip-attestation"
      ],
      { cwd: process.cwd(), encoding: "utf8" }
    );

    expect(result.status).toBe(0);
  });

  maybeIt("fails when checksum does not match bundle", () => {
    const projectDir = makeTempDir("skillbase-release-consumer-verify-fail-");
    mkdirSync(join(projectDir, "skills", "safe"), { recursive: true });
    writeFileSync(
      join(projectDir, "skills", "safe", "SKILL.md"),
      `---\nname: safe\ndescription: safe skill\n---\n\n# Safe\n`,
      "utf8"
    );
    writeFileSync(
      join(projectDir, "skillbase.yml"),
      `version: 1\nskillsets:\n  base:\n    skills:\n      - source: local:./skills\napply:\n  useSkillsets: [base]\n`,
      "utf8"
    );

    const keyPair = generateKeyPairSync("ed25519");
    const privateKeyPath = join(projectDir, "bundle-private.pem");
    const publicKeyPath = join(projectDir, "bundle-public.pem");
    writeFileSync(privateKeyPath, keyPair.privateKey.export({ format: "pem", type: "pkcs8" }).toString(), "utf8");
    writeFileSync(publicKeyPath, keyPair.publicKey.export({ format: "pem", type: "spki" }).toString(), "utf8");

    expect(runCli(["update"], projectDir).status).toBe(0);

    const bundlePath = join(projectDir, "skillbase-release.zip");
    expect(
      runCli(
        ["export", "--out", bundlePath, "--sign-private-key", privateKeyPath, "--deterministic", "--json"],
        projectDir,
        { SOURCE_DATE_EPOCH: "1704067200" }
      ).status
    ).toBe(0);

    const verifyJsonPath = join(projectDir, "skillbase-release.verify.json");
    const verify = runCli(
      ["verify-bundle", "--bundle", bundlePath, "--sign-public-key", publicKeyPath, "--require-signature", "--json"],
      projectDir
    );
    expect(verify.status).toBe(0);
    writeFileSync(verifyJsonPath, verify.stdout, "utf8");

    const checksumPath = join(projectDir, "SHA256SUMS");
    writeFileSync(checksumPath, `0000000000000000000000000000000000000000000000000000000000000000  ${join(projectDir, "skillbase-release.zip")}\n`, "utf8");

    const scriptPath = join(process.cwd(), "scripts", "verify_release_consumer_artifact.sh");
    const result = spawnSync(
      "bash",
      [
        scriptPath,
        "--artifact",
        bundlePath,
        "--checksums",
        checksumPath,
        "--verify-json",
        verifyJsonPath,
        "--public-key",
        publicKeyPath,
        "--skip-attestation"
      ],
      { cwd: process.cwd(), encoding: "utf8" }
    );

    expect(result.status).not.toBe(0);
  });
});
