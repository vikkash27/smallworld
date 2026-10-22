import type { DiscoverRequest, DiscoverResponse, ApiSuccess, ApiFailure } from '@/shared/contracts';
import discoverSample from '@/shared/fixtures/discover-response.sample.json';

export class ApiError extends Error {
  constructor(public error: ApiFailure['error'], public requestId: string) {
    super(error.message);
    this.name = 'ApiError';
  }
}

export async function discoverPeople(
  goal: string,
  communityIds: string[]
): Promise<DiscoverResponse> {
  const mode = process.env.NEXT_PUBLIC_DATA_MODE || 'mock';

  if (mode === 'mock') {
    return discoverSample as DiscoverResponse;
  }

  try {
    const request: DiscoverRequest = {
      goal,
      communityIds,
      mode: 'connections',
    };

    const res = await fetch('/api/intelligence/discover', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
    });

    if (!res.ok) {
      const failure = (await res.json()) as ApiFailure;
      throw new ApiError(failure.error, failure.requestId);
    }

    const success = (await res.json()) as ApiSuccess<DiscoverResponse>;
    return success.data;
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    throw new Error('Failed to fetch discovery results');
  }
}
