export type Optional<T, K extends keyof T> = Omit<T, K> & Partial<T>;
export type PartialExcept<T, K extends keyof T> = Pick<T, K> & Partial<T>;
/**
 * Fills the required fields of a partial configuration with the fields from a default config.
 *
 * @param partialConfig
 * @param defaults
 */
export declare function fillMissingWithDefaults<T>(partialConfig: Partial<T>, defaults: T): T;
/**
 * Read a .json file and parse its context - or return an empty object if file does not exist.
 *
 * This is perfect for loading configuration files.
 *
 * @param fileName
 */
export declare function readJsonFileOrEmpty(fileName: string): Promise<unknown>;
/**
 * This function can be used to assign a value to a tree of objects.
 *
 * This function handles such special cases where an intermediate object is undefined and
 * creates such objects if needed.
 *
 * Example: If you write assignConfigOption({}, 'a.b', 'hello') you will get this object:
 * {
 *     a: {
 *         b: 'hello'
 *     }
 * }
 *
 * @param config - The configuration object to modify
 * @param dottedPath - The path to the element to add / change
 * @param value - The value to assign
 */
export declare function assignConfigOption(config: Record<string, unknown>, dottedPath: string, value: unknown): void;
//# sourceMappingURL=configHelper.d.ts.map