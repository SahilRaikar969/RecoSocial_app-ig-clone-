type MediaSkeletonProps = {
  className?: string
}

export function MediaSkeleton({ className = '' }: MediaSkeletonProps) {
  return (
    <div
      className={`relative overflow-hidden bg-zinc-950 ${className}`}
      aria-hidden="true"
    >
      <div className="absolute inset-0 animate-pulse bg-[linear-gradient(90deg,rgba(24,24,24,0.95),rgba(42,42,42,0.95),rgba(24,24,24,0.95))]" />
    </div>
  )
}