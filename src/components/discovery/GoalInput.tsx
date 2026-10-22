'use client';

import React, { useState } from 'react';
import { Button } from '@/ui/discovery/primitives';
import { Search } from 'lucide-react';

export interface GoalInputProps {
  onSearch: (goal: string) => void;
  isLoading?: boolean;
  defaultValue?: string;
}

export function GoalInput({ onSearch, isLoading, defaultValue = '' }: GoalInputProps) {
  const [goal, setGoal] = useState(defaultValue);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (goal.trim()) {
      onSearch(goal.trim());
    }
  };

  return (
    <form onSubmit={handleSubmit} className="w-full">
      <div className="flex flex-col gap-4">
        <label htmlFor="goal" className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold text-[var(--foreground)]">
          What do you want to build?
        </label>
        <div className="flex flex-col sm:flex-row gap-3">
          <input
            id="goal"
            type="text"
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
            placeholder="Warehouse robotics with other builders in London."
            className="flex-1 rounded-lg border-2 border-[var(--border)] bg-white px-4 py-3 text-base text-[var(--foreground)] placeholder:text-[var(--secondary-text)] focus:border-[var(--brand)] focus:outline-none focus:ring-2 focus:ring-[var(--brand)]/20 min-h-[44px]"
            disabled={isLoading}
          />
          <Button
            type="submit"
            disabled={!goal.trim() || isLoading}
            className="sm:w-auto"
          >
            <Search className="mr-2 h-5 w-5" />
            {isLoading ? 'Searching...' : 'Find people'}
          </Button>
        </div>
      </div>
    </form>
  );
}
