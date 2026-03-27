export type ErrorKind = "parse" | "write" | "validation" | "scan";

/**
 * Base error class for all ATM domain errors.
 * Provides a `kind` discriminant for narrowing via switch/case.
 * Subclasses can be narrowed via `instanceof`.
 */
export class AtmError extends Error {
  constructor(
    public readonly kind: ErrorKind,
    message: string,
    public readonly cause?: unknown
  ) {
    super(message);
    this.name = "AtmError";
    // Preserve prototype chain in transpiled output
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/** Thrown when a file cannot be read or parsed (gray-matter, JSONC, etc.) */
export class ParseError extends AtmError {
  constructor(message: string, cause?: unknown) {
    super("parse", message, cause);
    this.name = "ParseError";
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/** Thrown when a file write or rename operation fails */
export class WriteError extends AtmError {
  constructor(message: string, cause?: unknown) {
    super("write", message, cause);
    this.name = "WriteError";
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/** Thrown when Zod schema validation fails on a parsed config */
export class ValidationError extends AtmError {
  constructor(message: string, cause?: unknown) {
    super("validation", message, cause);
    this.name = "ValidationError";
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/** Thrown when a directory scan or file discovery operation fails */
export class ScanError extends AtmError {
  constructor(message: string, cause?: unknown) {
    super("scan", message, cause);
    this.name = "ScanError";
    Object.setPrototypeOf(this, new.target.prototype);
  }
}
