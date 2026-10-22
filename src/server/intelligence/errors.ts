/** Model/provider failure. Empty discovery is not this error. */
export class ProviderUnavailableError extends Error {
  readonly code = "PROVIDER_UNAVAILABLE" as const;
  readonly retryable: boolean;

  constructor(message: string, retryable = true) {
    super(message);
    this.name = "ProviderUnavailableError";
    this.retryable = retryable;
  }
}
