export function MediaSkeleton({ className = '' }: { className?: string }) {
  return <div aria-hidden="true" className={`bg-zinc-800 motion-safe:animate-pulse ${className}`} />
}
