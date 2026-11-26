// schools: middle/high school search backed by the NEIS Open API (학교기본정보).
//
// GET  /schools?q=<name>        or
// POST /schools  { "q": "<name>" }
//
// Requires a signed-in user (verify_jwt = true). The NEIS key is read only from
// the NEIS_API_KEY secret and must never be logged or returned.

import { AppError, jsonResponse, withErrorHandling } from "../_shared/errors.ts";

const NEIS_URL = "https://open.neis.go.kr/hub/schoolInfo";
const NEIS_TIMEOUT_MS = 5000;
const NEIS_PAGE_SIZE = 20;
const SCHOOL_KINDS = ["중학교", "고등학교"] as const;
const MIN_QUERY_LENGTH = 2;
const MAX_QUERY_LENGTH = 50;
const MAX_RESULTS = 20;

interface NeisRow {
  SD_SCHUL_CODE?: string | null;
  SCHUL_NM?: string | null;
  SCHUL_KND_SC_NM?: string | null;
  LCTN_SC_NM?: string | null;
  ORG_RDNMA?: string | null;
}

interface School {
  school_code: string;
  school_name: string;
  school_kind: string;
  region: string | null;
  address: string | null;
}

// --- NEIS access (the only place that talks to NEIS) -------------------------

/** Fetches schools of one kind whose name matches `name`. Throws AppError(502) on any NEIS failure. */
async function fetchNeisSchools(name: string, kind: string): Promise<NeisRow[]> {
  const key = Deno.env.get("NEIS_API_KEY");
  if (!key) {
    console.error("schools: NEIS_API_KEY is not set");
    throw new AppError(500, "server_misconfigured", "Server is not configured");
  }

  const url = new URL(NEIS_URL);
  url.searchParams.set("KEY", key);
  url.searchParams.set("Type", "json");
  url.searchParams.set("pIndex", "1");
  url.searchParams.set("pSize", String(NEIS_PAGE_SIZE));
  url.searchParams.set("SCHUL_NM", name);
  url.searchParams.set("SCHUL_KND_SC_NM", kind);

  let body: unknown;
  try {
    // Never log `url` or the caught error's message: the URL contains the key.
    const res = await fetch(url, { signal: AbortSignal.timeout(NEIS_TIMEOUT_MS) });
    if (!res.ok) {
      console.error(`schools: NEIS responded with HTTP ${res.status}`);
      throw new AppError(502, "upstream_error", "School search is unavailable");
    }
    body = await res.json();
  } catch (err) {
    if (err instanceof AppError) throw err;
    const reason = err instanceof Error ? err.name : "unknown";
    console.error(`schools: NEIS request failed (${reason})`);
    throw new AppError(
      502,
      reason === "TimeoutError" ? "upstream_timeout" : "upstream_error",
      "School search is unavailable",
    );
  }

  // Error / empty responses: { RESULT: { CODE, MESSAGE } } at the top level.
  const topResult = (body as { RESULT?: { CODE?: string } })?.RESULT;
  if (topResult) {
    if (topResult.CODE === "INFO-200") return []; // no data
    console.error(`schools: NEIS returned ${topResult.CODE}`);
    throw new AppError(502, "upstream_error", "School search is unavailable");
  }

  // Success: { schoolInfo: [ { head: [...] }, { row: [...] } ] }
  const sections = (body as { schoolInfo?: Array<{ row?: NeisRow[] }> })?.schoolInfo;
  if (!Array.isArray(sections)) {
    console.error("schools: unexpected NEIS response shape");
    throw new AppError(502, "upstream_error", "School search is unavailable");
  }
  return sections.find((s) => Array.isArray(s.row))?.row ?? [];
}

// --- Request handling --------------------------------------------------------

async function readQuery(req: Request): Promise<string> {
  let raw: unknown;
  if (req.method === "GET") {
    raw = new URL(req.url).searchParams.get("q");
  } else if (req.method === "POST") {
    try {
      raw = (await req.json())?.q;
    } catch {
      throw new AppError(400, "invalid_request", "Request body must be JSON");
    }
  } else {
    throw new AppError(405, "method_not_allowed", "Use GET or POST");
  }

  const q = typeof raw === "string" ? raw.trim() : "";
  const length = Array.from(q).length;
  if (length < MIN_QUERY_LENGTH) {
    throw new AppError(
      400,
      "invalid_query",
      `q must be at least ${MIN_QUERY_LENGTH} characters`,
    );
  }
  if (length > MAX_QUERY_LENGTH) {
    throw new AppError(
      400,
      "invalid_query",
      `q must be at most ${MAX_QUERY_LENGTH} characters`,
    );
  }
  return q;
}

function toSchool(row: NeisRow): School | null {
  const code = row.SD_SCHUL_CODE?.trim();
  const name = row.SCHUL_NM?.trim();
  const kind = row.SCHUL_KND_SC_NM?.trim();
  // Planned schools have a blank code; skip anything we can't identify.
  if (!code || !name || !kind) return null;
  if (!(SCHOOL_KINDS as readonly string[]).includes(kind)) return null;
  return {
    school_code: code,
    school_name: name,
    school_kind: kind,
    region: row.LCTN_SC_NM?.trim() || null,
    address: row.ORG_RDNMA?.trim() || null,
  };
}

Deno.serve(withErrorHandling(async (req) => {
  const q = await readQuery(req);

  const results = await Promise.all(
    SCHOOL_KINDS.map((kind) => fetchNeisSchools(q, kind)),
  );

  const seen = new Set<string>();
  const schools: School[] = [];
  for (const row of results.flat()) {
    const school = toSchool(row);
    if (!school || seen.has(school.school_code)) continue;
    seen.add(school.school_code);
    schools.push(school);
  }
  schools.sort((a, b) => a.school_name.localeCompare(b.school_name, "ko"));

  return jsonResponse({ schools: schools.slice(0, MAX_RESULTS) });
}));
