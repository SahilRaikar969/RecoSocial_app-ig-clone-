import { safeReturnPath } from '@/lib/routes/safe-return-path'
import { CameraStudio } from '@/components/camera/camera-studio'
import { getAllCategories } from '@/lib/db/queries/categories'

type CameraPageProps = {
  searchParams?: Promise<{
    returnTo?: string
  }>
}

export const metadata = { title: "Camera" }

export default async function CameraPage({
  searchParams,
}: CameraPageProps) {
  const params = searchParams ? await searchParams : undefined
  const returnTo = safeReturnPath(String(params?.returnTo || '/feed'))
  const categories = await getAllCategories()

  return (
    <CameraStudio
      returnTo={returnTo}
      categories={categories}
    />
  )
}