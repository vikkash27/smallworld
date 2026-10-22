import type {
  BootstrapResponse,
  Community,
  ApiSuccess,
  ApiFailure,
} from '@/shared/contracts';
import bootstrapSample from '@/shared/fixtures/bootstrap.sample.json';
import communitiesSample from '@/shared/fixtures/communities.sample.json';

export class ApiError extends Error {
  constructor(public error: ApiFailure['error'], public requestId: string) {
    super(error.message);
    this.name = 'ApiError';
  }
}

export async function getBootstrap(): Promise<BootstrapResponse> {
  const mode = process.env.NEXT_PUBLIC_DATA_MODE || 'mock';

  if (mode === 'mock') {
    return bootstrapSample as BootstrapResponse;
  }

  try {
    const res = await fetch('/api/platform/bootstrap');

    if (!res.ok) {
      const failure = (await res.json()) as ApiFailure;
      throw new ApiError(failure.error, failure.requestId);
    }

    const success = (await res.json()) as ApiSuccess<BootstrapResponse>;
    return success.data;
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    throw new Error('Failed to fetch bootstrap data');
  }
}

export async function getCommunities(): Promise<Community[]> {
  const mode = process.env.NEXT_PUBLIC_DATA_MODE || 'mock';

  if (mode === 'mock') {
    return communitiesSample as Community[];
  }

  try {
    const res = await fetch('/api/platform/communities');

    if (!res.ok) {
      const failure = (await res.json()) as ApiFailure;
      throw new ApiError(failure.error, failure.requestId);
    }

    const success = (await res.json()) as ApiSuccess<Community[]>;
    return success.data;
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    throw new Error('Failed to fetch communities');
  }
}
