import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/database.types'

/** @supabase/ssr auto-exchanges a PKCE callback during initialize; do not exchange it twice. */
export async function preparePasswordRecovery(client: SupabaseClient<Database>, params: {code?:string|null;tokenHash?:string|null;type?:string|null;error?:string|null}) {
  if(params.error) throw new Error('Invalid or expired recovery link.')
  if(params.tokenHash) {
    if(params.type!=='recovery')throw new Error('Not a recovery link.')
    const result=await client.auth.verifyOtp({token_hash:params.tokenHash,type:'recovery'})
    if(result.error)throw new Error('Invalid or expired recovery link.')
  } else {
    // Initialization awaits the SDK's automatic PKCE/implicit callback detection.
    const result=await client.auth.initialize()
    if(result.error)throw new Error('Invalid or expired recovery link.')
  }
  const verified=await client.auth.getUser()
  if(verified.error || !verified.data.user)throw new Error('Sign in or request a new recovery link.')
}

/** Remove consumed one-time credentials from the address bar and history entry. */
export function recoveryReturnPath(value: string) {
  const url = new URL(value)
  for (const key of ['code', 'token_hash', 'type', 'error', 'error_code', 'error_description']) url.searchParams.delete(key)
  return url.pathname + url.search
}
