import React from 'react';

/**
 * Base primitive Skeleton component with shimmer animation
 */
export function Skeleton({ className = '', rounded = 'rounded-xl', ...props }) {
  return (
    <div
      className={`animate-pulse bg-gradient-to-r from-cinema-800/80 via-cinema-700/50 to-cinema-800/80 ${rounded} ${className}`}
      {...props}
    />
  );
}

/**
 * Skeleton placeholder for movie cards in MoviesPage and HomePage
 */
export function MovieCardSkeleton() {
  return (
    <div className="glass-panel rounded-2xl overflow-hidden border border-cinema-700/50 flex flex-col animate-pulse">
      {/* Poster placeholder */}
      <div className="relative aspect-[2/3] bg-cinema-800/80">
        <div className="absolute top-2.5 left-2.5 w-10 h-5 bg-cinema-700 rounded-md" />
        <div className="absolute bottom-3 right-3 w-8 h-8 rounded-full bg-cinema-700" />
      </div>

      {/* Info placeholder */}
      <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
        <div className="space-y-2">
          <div className="h-3 w-24 bg-cinema-700/60 rounded-md" />
          <div className="h-5 w-3/4 bg-cinema-700 rounded-md" />
          <div className="flex gap-2 pt-1">
            <div className="h-3 w-16 bg-cinema-800 rounded-md" />
            <div className="h-3 w-12 bg-cinema-800 rounded-md" />
          </div>
        </div>

        {/* Button placeholder */}
        <div className="h-9 w-full bg-cinema-700/70 rounded-xl mt-2" />
      </div>
    </div>
  );
}

/**
 * Grid of movie card skeletons
 */
export function MovieGridSkeleton({ count = 8 }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4 gap-6">
      {Array.from({ length: count }).map((_, idx) => (
        <MovieCardSkeleton key={idx} />
      ))}
    </div>
  );
}

/**
 * Skeleton placeholder for SchedulesPage
 */
export function ScheduleListSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Date bar placeholder */}
      <div className="flex gap-3 overflow-x-auto pb-2">
        {Array.from({ length: 6 }).map((_, idx) => (
          <div key={idx} className="h-16 w-20 shrink-0 bg-cinema-800 rounded-2xl" />
        ))}
      </div>

      {/* Schedule cards placeholder */}
      {Array.from({ length: 3 }).map((_, idx) => (
        <div key={idx} className="glass-panel p-5 rounded-2xl border border-cinema-700/50 space-y-4">
          <div className="flex items-center gap-4">
            <div className="w-16 h-24 bg-cinema-800 rounded-xl shrink-0" />
            <div className="space-y-2 flex-1">
              <div className="h-5 w-1/3 bg-cinema-700 rounded-md" />
              <div className="h-3.5 w-1/4 bg-cinema-800 rounded-md" />
            </div>
          </div>
          <div className="flex flex-wrap gap-2 pt-2">
            {Array.from({ length: 5 }).map((_, slotIdx) => (
              <div key={slotIdx} className="h-10 w-24 bg-cinema-800 rounded-xl" />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
