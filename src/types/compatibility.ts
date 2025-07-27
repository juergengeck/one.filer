/**
 * Type compatibility fixes for mismatched versions between one.core and one.models
 */

// Re-export types that may be missing or incompatible
export type SHA256Hash<T = any> = any;
export type SHA256IdHash<T = any> = any;

// Provide compatibility for error types
export interface ErrorWithCode extends Error {
    code: string;
}

// Re-export HashTypes if missing
export const HashTypes = {
    SHA256: 'sha256'
} as const;

export type HashType = typeof HashTypes[keyof typeof HashTypes];