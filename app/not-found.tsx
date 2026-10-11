import { NavigationLink as Link } from '@/components/ui/navigation-link'
export default function NotFound() {
  return <section className="mx-auto max-w-xl py-12 text-center"><h1 className="text-2xl font-semibold">Page not found</h1><p className="mt-3 text-sm text-zinc-400">This link may be incomplete or the content is no longer available.</p><div className="mt-6 flex flex-wrap justify-center gap-3"><Link href="/feed" className="rs-button rs-button-primary">Back to feed</Link><Link href="/explore" className="rs-button">Explore</Link></div></section>
}
