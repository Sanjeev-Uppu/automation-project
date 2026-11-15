export function Skeleton({ className = "" }: { className?: string }) {
  return <div aria-hidden="true" className={`motion-safe:animate-pulse rounded-lg bg-sand-200/60 ${className}`} />;
}

export function StatCardsSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div role="status" aria-label="Loading ticket counts" className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
      {Array.from({ length: count }, (_, i) => <Skeleton key={i} className="h-24" />)}
    </div>
  );
}
