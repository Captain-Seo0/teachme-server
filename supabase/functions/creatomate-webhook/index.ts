// creatomate-webhook: render-status callbacks from Creatomate. Not implemented yet.
// Called by Creatomate (no user JWT): verify_jwt is disabled in config.toml,
// so signature/secret verification must be added here when implementing.

import { notImplemented, withErrorHandling } from "../_shared/errors.ts";

Deno.serve(withErrorHandling(() => {
  throw notImplemented("creatomate-webhook");
}));
