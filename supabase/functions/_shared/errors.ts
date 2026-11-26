// Unified JSON response / error format for all Edge Functions.
//
// Error body: { "error": { "code": string, "message": string, "details"?: unknown } }

import { corsHeaders, handleCors } from "./cors.ts";

export class AppError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "AppError";
  }
}

const jsonHeaders = { ...corsHeaders, "Content-Type": "application/json" };

export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: jsonHeaders });
}

export function errorResponse(err: unknown): Response {
  if (err instanceof AppError) {
    return jsonResponse(
      { error: { code: err.code, message: err.message, details: err.details } },
      err.status,
    );
  }
  console.error(err);
  return jsonResponse(
    { error: { code: "internal_error", message: "Internal server error" } },
    500,
  );
}

export const notImplemented = (what: string) =>
  new AppError(501, "not_implemented", `${what} is not implemented yet`);

/** Wraps a handler with CORS preflight handling and JSON error responses. */
export function withErrorHandling(
  handler: (req: Request) => Promise<Response> | Response,
): (req: Request) => Promise<Response> {
  return async (req) => {
    const preflight = handleCors(req);
    if (preflight) return preflight;
    try {
      return await handler(req);
    } catch (err) {
      return errorResponse(err);
    }
  };
}
