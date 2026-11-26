// materials: study material ingestion (async job). Not implemented yet.

import { notImplemented, withErrorHandling } from "../_shared/errors.ts";

Deno.serve(withErrorHandling(() => {
  throw notImplemented("materials");
}));
