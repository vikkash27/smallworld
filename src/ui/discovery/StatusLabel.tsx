import React from 'react';
import type { DataMode } from '@/shared/contracts';

export interface StatusLabelProps {
  dataMode: DataMode;
  retrievalBackend?: 'cognee' | 'local';
}

export function StatusLabel({ dataMode, retrievalBackend }: StatusLabelProps) {
  if (dataMode === 'sample') {
    return (
      <div className="text-xs text-[var(--secondary-text)]">
        Sample data
      </div>
    );
  }

  if (retrievalBackend) {
    return (
      <div className="text-xs text-[var(--secondary-text)]">
        Live · {retrievalBackend === 'cognee' ? 'Cognee' : 'Local'}
      </div>
    );
  }

  return (
    <div className="text-xs text-[var(--secondary-text)]">
      Live
    </div>
  );
}
