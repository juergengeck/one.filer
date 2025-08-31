"use strict";
/**
 * Local type checking utilities to replace missing exports from one.core
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.SET_ACCESS_MODE = exports.isFunction = exports.isString = exports.isObject = void 0;
/**
 * Checks if a value is a non-null object (excluding arrays)
 * @param thing - The value to check
 * @returns true if the value is a non-null object but not an array
 */
function isObject(thing) {
    return typeof thing === 'object' && thing !== null && !Array.isArray(thing);
}
exports.isObject = isObject;
/**
 * Checks if a value is a string
 * @param thing - The value to check
 * @returns true if the value is a string
 */
function isString(thing) {
    return typeof thing === 'string';
}
exports.isString = isString;
/**
 * Checks if a value is a function
 * @param thing - The value to check
 * @returns true if the value is a function
 */
function isFunction(thing) {
    return typeof thing === 'function';
}
exports.isFunction = isFunction;
/**
 * String constants for SetAccessParam's mode parameter
 * Replaces missing SET_ACCESS_MODE export from one.core
 */
exports.SET_ACCESS_MODE = {
    REPLACE: 'replace',
    ADD: 'add'
};
//# sourceMappingURL=typeChecks.js.map