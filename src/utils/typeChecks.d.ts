/**
 * Local type checking utilities to replace missing exports from one.core
 */
/**
 * Checks if a value is a non-null object
 * @param thing - The value to check
 * @returns true if the value is a non-null object
 */
export declare function isObject(thing: unknown): thing is Record<string, any>;
/**
 * Checks if a value is a string
 * @param thing - The value to check
 * @returns true if the value is a string
 */
export declare function isString(thing: unknown): thing is string;
/**
 * Checks if a value is a function
 * @param thing - The value to check
 * @returns true if the value is a function
 */
export declare function isFunction(thing: unknown): thing is Function;
/**
 * String constants for SetAccessParam's mode parameter
 * Replaces missing SET_ACCESS_MODE export from one.core
 */
export declare const SET_ACCESS_MODE: {
    readonly REPLACE: "replace";
    readonly ADD: "add";
};
//# sourceMappingURL=typeChecks.d.ts.map