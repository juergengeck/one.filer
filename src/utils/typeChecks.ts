/**
 * Local type checking utilities to replace missing exports from one.core
 */

/**
 * Checks if a value is a non-null object (excluding arrays)
 * @param thing - The value to check
 * @returns true if the value is a non-null object but not an array
 */
export function isObject(thing: unknown): thing is Record<string, any> {
    return typeof thing === 'object' && thing !== null && !Array.isArray(thing);
}

/**
 * Checks if a value is a string
 * @param thing - The value to check
 * @returns true if the value is a string
 */
export function isString(thing: unknown): thing is string {
    return typeof thing === 'string';
}

/**
 * Checks if a value is a function
 * @param thing - The value to check
 * @returns true if the value is a function
 */
export function isFunction(thing: unknown): thing is Function {
    return typeof thing === 'function';
}

/**
 * String constants for SetAccessParam's mode parameter
 * Replaces missing SET_ACCESS_MODE export from one.core
 */
export const SET_ACCESS_MODE = {
    REPLACE: 'replace',
    ADD: 'add'
} as const; 