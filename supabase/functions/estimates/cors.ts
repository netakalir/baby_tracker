/**
 * Shared CORS handling for the `estimates` function. The frontend calls this
 * from the browser, so preflight (OPTIONS) and the access-control headers are
 * required. Kept permissive on origin (the JWT is the real access control) but
 * restricted to the methods and headers this function actually uses.
 */

export const corsHeaders: Readonly<Record<string, string>> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

/** Builds a JSON `Response` with CORS headers merged in. */
export function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}
