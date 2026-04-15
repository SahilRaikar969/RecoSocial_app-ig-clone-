import Link from 'next/link'
import { EditProfileForm } from '@/components/profile/edit-profile-form'
import { getDevSession } from '@/lib/auth/get-dev-session'
import { getEditableProfile } from '@/lib/db/queries/profile-edit'

export default async function EditProfilePage({
  searchParams,
}: {
  searchParams?: Promise<{ error?: string }>
}) {
  const params = searchParams ? await searchParams : undefined
  const { profileId } = await getDevSession()
  const profile = await getEditableProfile(profileId)

  const error = params?.error || ''

  const errorMessage =
    error === 'missing_profile_id'
      ? 'Profile id is missing.'
      : error === 'username_required'
        ? 'Username is required.'
        : error === 'display_name_required'
          ? 'Display name is required.'
          : error === 'display_name_too_long'
            ? 'Display name is too long.'
            : error === 'username_too_long'
              ? 'Username is too long.'
              : error === 'bio_too_long'
                ? 'Bio is too long.'
                : error === 'invalid_username'
                  ? 'Username can only use lowercase letters, numbers, dots, and underscores.'
                  : error === 'invalid_avatar_url'
                    ? 'Avatar URL must be a valid http or https URL.'
                    : error === 'invalid_avatar_file_type'
                      ? 'Avatar file must be JPG, PNG, WEBP, or GIF.'
                      : error === 'avatar_file_too_large'
                        ? 'Avatar file is too large. Keep it under 10 MB.'
                        : error === 'avatar_upload_failed'
                          ? 'Avatar upload failed. Check the media bucket and policies.'
                          : error === 'username_taken'
                            ? 'That username is already taken.'
                            : error
                              ? `Profile update failed: ${decodeURIComponent(error)}`
                              : ''

  return (
    <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
      <section className="mb-6 overflow-hidden rounded-[32px] border border-zinc-800/90 bg-black">
        <div className="border-b border-zinc-800/80 px-5 py-5 sm:px-6">
          <div className="inline-flex rounded-full border border-zinc-800 bg-zinc-950 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.18em] text-zinc-400">
            Profile settings
          </div>

          <div className="mt-4 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h1 className="text-3xl font-semibold tracking-tight text-white">
                Edit profile
              </h1>

              <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-400">
                Update the identity layer powering author headers, creator discovery, activity rows, comments, and profile trust.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Link
                href="/profile"
                className="rounded-2xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-sm font-medium text-zinc-300 transition hover:border-zinc-500 hover:text-white"
              >
                Back to profile
              </Link>

              <Link
                href="/feed"
                className="rounded-2xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-sm font-medium text-zinc-300 transition hover:border-zinc-500 hover:text-white"
              >
                Back to home
              </Link>
            </div>
          </div>
        </div>

        <div className="grid gap-3 px-5 py-5 sm:grid-cols-3 sm:px-6">
          <div className="rounded-2xl border border-zinc-800 bg-zinc-950/80 p-4">
            <p className="text-xs uppercase tracking-[0.16em] text-zinc-500">
              Identity
            </p>
            <p className="mt-2 text-sm font-medium text-white">
              Username, display name, and bio
            </p>
          </div>

          <div className="rounded-2xl border border-zinc-800 bg-zinc-950/80 p-4">
            <p className="text-xs uppercase tracking-[0.16em] text-zinc-500">
              Trust
            </p>
            <p className="mt-2 text-sm font-medium text-white">
              Stronger creator presence across the product
            </p>
          </div>

          <div className="rounded-2xl border border-zinc-800 bg-zinc-950/80 p-4">
            <p className="text-xs uppercase tracking-[0.16em] text-zinc-500">
              Avatar
            </p>
            <p className="mt-2 text-sm font-medium text-white">
              Upload directly or use a stable fallback URL
            </p>
          </div>
        </div>
      </section>

      <EditProfileForm profile={profile} errorMessage={errorMessage} />
    </main>
  )
}