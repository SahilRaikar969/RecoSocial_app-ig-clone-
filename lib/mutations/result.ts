/** Public action outcomes contain stable codes, never database error details. */
export type MutationResult<T extends object> =
  | ({ ok: true } & T)
  | { ok: false; error: string }
