import { createHmac } from "node:crypto";
import type { Config, LexicalDocument } from "./types.js";
import { fetchWithRetry } from "./http.js";

export function generateJwt(apiKey: string): string {
  const [keyId, secretHex] = apiKey.split(":");
  if (!keyId || !secretHex) {
    throw new Error(
      'Invalid Ghost Admin API key format. Expected "KEY_ID:SECRET_HEX"',
    );
  }

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

function ghostHeaders(apiKey: string): Record<string, string> {
  return {
    Authorization: `Ghost ${generateJwt(apiKey)}`,
    "Content-Type": "application/json",
    "User-Agent": "Mozilla/5.0 ghost-github-portfolio",
  };
}

interface GhostPage {
  id: string;
  updated_at: string;
  title: string;
  lexical: string;
}

export async function fetchPage(config: Config): Promise<GhostPage> {
  const { url, adminApiKey, pageId, pageSlug } = config.ghost;

  let endpoint: string;
  if (pageId) {
    endpoint = `${url}/ghost/api/admin/pages/${pageId}/`;
  } else {
    endpoint = `${url}/ghost/api/admin/pages/slug/${pageSlug}/`;
  }

  const res = await fetchWithRetry(endpoint, {
    headers: ghostHeaders(adminApiKey),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Ghost API error ${res.status}: ${body}`);
  }

  const data = (await res.json()) as { pages: GhostPage[] };
  return data.pages[0];
}

export async function updatePage(
  config: Config,
  pageId: string,
  updatedAt: string,
  lexical: LexicalDocument,
): Promise<GhostPage> {
  const { url, adminApiKey } = config.ghost;
  const endpoint = `${url}/ghost/api/admin/pages/${pageId}/`;

  const body = {
    pages: [
      {
        lexical: JSON.stringify(lexical),
        updated_at: updatedAt,
      },
    ],
  };

  const res = await fetchWithRetry(endpoint, {
    method: "PUT",
    headers: ghostHeaders(adminApiKey),
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Ghost update error ${res.status}: ${text}`);
  }

  const data = (await res.json()) as { pages: GhostPage[] };
  return data.pages[0];
}
