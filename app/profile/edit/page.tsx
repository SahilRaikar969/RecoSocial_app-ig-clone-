import { PageShell } from '@/components/ui/page-shell'
import { SurfaceHero } from '@/components/ui/surface-hero'
import { EditProfileForm } from '@/components/profile/edit-profile-form'
import { requireSession } from '@/lib/auth/session'
import { getEditableProfile } from '@/lib/db/queries/profile-edit'

export const metadata = { title: "Edit profile" }

export default async function EditProfilePage({
  searchParams,
}: {
  searchParams?: Promise<{ error?: string }>
}) {
  const params = searchParams ? await searchParams : undefined
  const { profileId } = await requireSession()
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
                          ? 'Profile photo upload failed. Please try again.'
                          : error === 'username_taken'
                            ? 'That username is already taken.'
                            : error
                              ? `Profile update failed: ${error}`
                              : ''

  return (
    <PageShell maxWidth="6xl">
      <SurfaceHero title="Edit profile" />
      <EditProfileForm profile={profile} errorMessage={errorMessage} />
    </PageShell>
  )
}
