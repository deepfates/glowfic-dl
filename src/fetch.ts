import type { Response } from "node-fetch";
import fetch from "node-fetch";

import { GLOWFIC_ROOT } from "./types.js";

export async function httpGet(
  url: string,
  params?: Record<string, string | number>,
): Promise<Response> {
  const fullUrl = new URL(url, GLOWFIC_ROOT);
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      fullUrl.searchParams.set(k, String(v));
    }
  }
  return fetch(fullUrl.toString(), {
    redirect: "follow",
    headers: {
      "User-Agent": "glowfic-dl-ts/0.1",
    },
  });
}

export async function getText(
  url: string,
  params?: Record<string, string | number>,
): Promise<string> {
  const resp = await httpGet(url, params);
  if (!resp.ok) {
    const body = await resp.text();
    throw new Error(`GET ${url} failed: ${resp.status} ${resp.statusText}\n${body}`);
  }
  return resp.text();
}

export async function getJson<T>(
  url: string,
  params?: Record<string, string | number>,
): Promise<T> {
  const resp = await httpGet(url, params);
  if (!resp.ok) {
    const body = await resp.text();
    throw new Error(`GET ${url} failed: ${resp.status} ${resp.statusText}\n${body}`);
  }
  return resp.json() as Promise<T>;
}
