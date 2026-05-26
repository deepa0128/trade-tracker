export class TrackError extends Error {
  constructor(
    message: string,
    readonly code: string,
  ) {
    super(message);
    this.name = 'TrackError';
  }
}

export class ProviderError extends TrackError {
  constructor(
    message: string,
    readonly providerName: string,
  ) {
    super(message, 'PROVIDER_ERROR');
    this.name = 'ProviderError';
  }
}

export class ProviderUnavailableError extends ProviderError {
  constructor(providerName: string) {
    super(`Provider '${providerName}' is unavailable`, providerName);
    this.name = 'ProviderUnavailableError';
  }
}

export class ExchangeError extends TrackError {
  constructor(
    message: string,
    readonly exchangeId: string,
  ) {
    super(message, 'EXCHANGE_ERROR');
    this.name = 'ExchangeError';
  }
}

export class ValidationError extends TrackError {
  constructor(
    message: string,
    readonly field?: string,
  ) {
    super(message, 'VALIDATION_ERROR');
    this.name = 'ValidationError';
  }
}

export class PortfolioNotFoundError extends TrackError {
  constructor(readonly portfolioId: string) {
    super(`Portfolio not found: ${portfolioId}`, 'PORTFOLIO_NOT_FOUND');
    this.name = 'PortfolioNotFoundError';
  }
}

export class PredictionError extends TrackError {
  constructor(message: string) {
    super(message, 'PREDICTION_ERROR');
    this.name = 'PredictionError';
  }
}

export class AuthError extends TrackError {
  constructor(message: string) {
    super(message, 'AUTH_ERROR');
    this.name = 'AuthError';
  }
}

export class ForbiddenError extends TrackError {
  constructor(message = 'Access denied') {
    super(message, 'FORBIDDEN');
    this.name = 'ForbiddenError';
  }
}

export class ConflictError extends TrackError {
  constructor(message: string) {
    super(message, 'CONFLICT');
    this.name = 'ConflictError';
  }
}

export class DatabaseError extends TrackError {
  constructor(message: string) {
    super(message, 'DATABASE_ERROR');
    this.name = 'DatabaseError';
  }
}
