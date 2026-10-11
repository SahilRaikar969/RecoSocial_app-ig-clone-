import { NavigationLink as Link } from '@/components/ui/navigation-link'

export default function PostNotFound() {
  return (
    <section className="mx-auto max-w-xl py-12 text-center">
      <h1 className="text-2xl font-semibold text-white">Post not found</h1>
      <p className="mt-3 text-sm leading-6 text-zinc-400">This post is no longer available.</p>
      <Link href="/feed" className="rs-button rs-button-primary mt-6">Back to feed</Link>
    </section>
  )
}
