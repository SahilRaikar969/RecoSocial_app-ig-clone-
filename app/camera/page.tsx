import { CameraStudio } from '@/components/camera/camera-studio'
import { getAllCategories } from '@/lib/db/queries/categories'

type CameraPageProps = {
  searchParams?: Promise<{
    returnTo?: string
  }>
}

export default async function CameraPage({
  searchParams,
}: CameraPageProps) {
  const params = searchParams ? await searchParams : undefined
  const returnTo = String(params?.returnTo || '/feed').trim() || '/feed'
  const categories = await getAllCategories()

  return (
    <CameraStudio
      returnTo={returnTo}
      categories={categories}
    />
  )
}