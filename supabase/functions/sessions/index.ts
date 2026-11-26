// sessions: teaching sessions and report generation (async job). Not implemented yet.

import { notImplemented, withErrorHandling } from "../_shared/errors.ts";

Deno.serve(withErrorHandling(() => {
  throw notImplemented("sessions");
}));
