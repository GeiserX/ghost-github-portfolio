import { createHmac } from "node:crypto";
import type { Config, LexicalDocument } from "./types.js";
import { fetchWithRetry, rawRequest } from "./http.js";

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

function ghostHeaders(config: Config): Record<string, string> {
  const h: Record<string, string> = {
    Authorization: `Ghost ${generateJwt(config.ghost.adminApiKey)}`,
    "Content-Type": "application/json",
    "User-Agent": "Mozilla/5.0 ghost-github-portfolio",
  };
  if (config.ghost.originUrl) {
    const publicUrl = new URL(config.ghost.url);
    h.Host = config.ghost.hostHeader || publicUrl.host;
    h["X-Forwarded-Proto"] = "https";
  }
  return h;
}

/**
 * Where Admin API requests go. Normally the public Ghost URL. With
 * ghost.originUrl set they go straight to the origin (for example past a WAF
 * that rejects page bodies containing <img>), carrying the public Host and
 * X-Forwarded-Proto: https so Ghost answers as it would for the public site.
 * The JWT audience stays /admin/ either way.
 */
export function adminUrl(config: Config, path: string): string {
  const base = config.ghost.originUrl || config.ghost.url;
  return `${base}/ghost/api/admin/${path}`;
}

/**
 * Send an Admin API request. With originUrl set it goes through rawRequest,
 * because the global fetch drops a custom Host header.
 */
function send(
  config: Config,
  url: string,
  init: RequestInit = {},
): Promise<Response> {
  return fetchWithRetry(
    url,
    { ...init, headers: ghostHeaders(config) },
    config.ghost.originUrl ? { fetchImpl: rawRequest } : undefined,
  );
}

interface GhostPage {
  id: string;
  updated_at: string;
  title: string;
  lexical: string;
}

export async function fetchPage(config: Config): Promise<GhostPage> {
  const { pageId, pageSlug } = config.ghost;
  const endpoint = pageId
    ? adminUrl(config, `pages/${pageId}/`)
    : adminUrl(config, `pages/slug/${pageSlug}/`);

  const res = await send(config, endpoint);

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
  const endpoint = adminUrl(config, `pages/${pageId}/`);

  const body = {
    pages: [
      {
        lexical: JSON.stringify(lexical),
        updated_at: updatedAt,
      },
    ],
  };

  const res = await send(config, endpoint, {
    method: "PUT",
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Ghost update error ${res.status}: ${text}`);
  }

  const data = (await res.json()) as { pages: GhostPage[] };
  return data.pages[0];
}
