// ── Application auth errors ───────────────────────────────────────────────────
//
// Typed error classes for permission failures in Route Handlers.
// These are caught at the Route Handler boundary and mapped to HTTP responses.
// Raw Postgres errors are NEVER forwarded to clients.

export class UnauthorizedError extends Error {
  readonly status = 401
  constructor(message = 'Authentication required') {
    super(message)
    this.name = 'UnauthorizedError'
  }
}

export class ForbiddenError extends Error {
  readonly status = 403
  constructor(message = 'Insufficient permissions') {
    super(message)
    this.name = 'ForbiddenError'
  }
}

export class NotFoundError extends Error {
  readonly status = 404
  constructor(resource = 'Resource') {
    super(`${resource} not found`)
    this.name = 'NotFoundError'
  }
}

// Map an error to a { message, status } response body.
// Call this in every Route Handler catch block.
export function toApiError(err: unknown): { message: string; status: number } {
  if (err instanceof UnauthorizedError)
    return { message: err.message, status: 401 }
  if (err instanceof ForbiddenError)
    return { message: err.message, status: 403 }
  if (err instanceof NotFoundError)
    return { message: err.message, status: 404 }

  // All other errors: generic 500, no internal details leaked.
  console.error('Unhandled API error:', err)
  return { message: 'An unexpected error occurred', status: 500 }
}
