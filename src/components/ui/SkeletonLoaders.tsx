export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`skeleton-shimmer ${className}`} />;
}

export function DashboardSkeleton() {
  return (
    <div className="stack skeleton-page" aria-live="polite" aria-label="جاري تحميل الصفحة">
      <div className="skeleton-hero">
        <Skeleton className="h-pill w-260" />
        <Skeleton className="h-title w-420" />
        <Skeleton className="h-line w-520" />
      </div>
      <div className="skeleton-grid">
        {Array.from({ length: 4 }).map((_, index) => <Skeleton key={index} className="h-card" />)}
      </div>
      <Skeleton className="h-panel" />
    </div>
  );
}
