import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database, TablesInsert, TablesUpdate } from '@/lib/supabase/database.types'

// Compile-only assertions: this function is never called and performs no I/O.
export function assertDatabaseContracts(client: SupabaseClient<Database>) {
  const post: TablesInsert<'posts'> = { author_id: 'owner', media_type: 'image', media_path: 'post.jpg' }
  const profile: TablesUpdate<'profiles'> = { display_name: 'Creator' }
  void client.from('posts').insert(post)
  void client.from('profiles').update(profile)
  void client.rpc('get_visible_post_save_counts', { post_ids: ['id'] })
  void client.rpc('save_post_with_categories', {
    target_post_id: 'id', create_new: true, post_caption: null, post_media_type: 'image',
    post_media_path: 'path', post_thumbnail_path: null, category_ids: ['id'],
  })
  // @ts-expect-error Database has no invented table.
  void client.from('imaginary_table')
  // @ts-expect-error Comment ownership, post reference and body are required.
  void client.from('comments').insert({ author_id: 'owner' })
  // @ts-expect-error Updating a column absent from the schema is rejected.
  void client.from('profiles').update({ account_password: 'invalid' })
  // @ts-expect-error Publication cannot omit the typed category/media inputs.
  void client.rpc('save_post_with_categories', { target_post_id: 'id' })
  // @ts-expect-error Counts RPC accepts a UUID array, not a scalar.
  void client.rpc('get_visible_post_save_counts', { post_ids: 'id' })
}