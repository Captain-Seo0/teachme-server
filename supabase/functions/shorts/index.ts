// shorts: short-form video rendering via Creatomate (async job). Not implemented yet.

import { notImplemented, withErrorHandling } from "../_shared/errors.ts";

Deno.serve(withErrorHandling(() => {
  throw notImplemented("shorts");
}));
