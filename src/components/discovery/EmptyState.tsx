import React from 'react';

export function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <p className="mb-4 text-lg text-[var(--secondary-text)]">
        Try an example:
      </p>
      <p className="text-xl font-medium text-[var(--foreground)]">
        "Warehouse robotics with other builders in London"
      </p>
    </div>
  );
}
