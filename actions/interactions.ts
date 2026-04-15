'use server'

import { redirect } from 'next/navigation'

/*
  Legacy action file.
  Keep this as a safe redirect shim so any old forms still fail cleanly
  instead of using outdated client-trusted dev_profile_id logic.
  Real interaction logic now lives in:
  - actions/likes.ts
  - actions/saves.ts
  - actions/comments.ts
  - actions/follows.ts
*/

export async function toggleLike() {
  redirect('/feed?error=legacy_like_action_used')
}