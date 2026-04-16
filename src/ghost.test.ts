import { describe, it, expect } from "vitest";
import { createHmac } from "node:crypto";

// Test JWT generation logic directly (extracted for testability)
function generateJwt(apiKey: string): string {
  const [keyId, secretHex] = apiKey.split(":");
  const secret = Buffer.from(secretHex, "hex");
  const now = Math.floor(Date.now() / 1000);

  const header = Buffer.from(
    JSON.stringify({ alg: "HS256", kid: keyId, typ: "JWT" }),
  )
    .toString("base64url")
    .replace(/=+$/, "");

  const payload = Buffer.from(
    JSON.stringify({ iat: now, exp: now + 300, aud: "/admin/" }),
  )
    .toString("base64url")
    .replace(/=+$/, "");

  const signature = createHmac("sha256", secret)
    .update(`${header}.${payload}`)
    .digest("base64url")
    .replace(/=+$/, "");

  return `${header}.${payload}.${signature}`;
}

describe("Ghost JWT generation", () => {
  it("generates a valid 3-part JWT", () => {
    const jwt = generateJwt("keyid123:aabbccdd");

    const parts = jwt.split(".");
    expect(parts).toHaveLength(3);
  });

  it("encodes correct header with kid", () => {
    const jwt = generateJwt("mykey:aabbccdd");
    const header = JSON.parse(
      Buffer.from(jwt.split(".")[0], "base64url").toString(),
    );

    expect(header.alg).toBe("HS256");
    expect(header.kid).toBe("mykey");
    expect(header.typ).toBe("JWT");
  });

  it("encodes payload with aud /admin/", () => {
    const jwt = generateJwt("mykey:aabbccdd");
    const payload = JSON.parse(
      Buffer.from(jwt.split(".")[1], "base64url").toString(),
    );

    expect(payload.aud).toBe("/admin/");
    expect(payload.exp).toBe(payload.iat + 300);
  });

  it("signature is verifiable", () => {
    const secretHex = "aabbccdd";
    const jwt = generateJwt(`mykey:${secretHex}`);
    const [header, payload, signature] = jwt.split(".");

    const expected = createHmac("sha256", Buffer.from(secretHex, "hex"))
      .update(`${header}.${payload}`)
      .digest("base64url")
      .replace(/=+$/, "");

    expect(signature).toBe(expected);
  });
});
