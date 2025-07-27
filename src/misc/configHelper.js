import { isObject } from '../utils/typeChecks';
import { readFile } from 'fs/promises';
/**
 * Fills the required fields of a partial configuration with the fields from a default config.
 *
 * @param partialConfig
 * @param defaults
 */
export function fillMissingWithDefaults(partialConfig, defaults) {
    return Object.assign({}, defaults, partialConfig);
}
/**
 * Read a .json file and parse its context - or return an empty object if file does not exist.
 *
 * This is perfect for loading configuration files.
 *
 * @param fileName
 */
export async function readJsonFileOrEmpty(fileName) {
    let obj;
    try {
        obj = JSON.parse(await readFile(fileName, 'utf8'));
    }
    catch (err) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        if (err.code === 'ENOENT') {
            return {};
        }
        throw err;
    }
    return obj;
}
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
export function assignConfigOption(config, dottedPath, value) {
    if (value === undefined) {
        return;
    }
    const [first, ...other] = dottedPath.split('.');
    if (typeof config[first] === 'undefined') {
        if (other.length === 0) {
            config[first] = value;
            return;
        }
        else {
            config[first] = {};
        }
    }
    else if (other.length === 0) {
        config[first] = value;
        return;
    }
    if (!isObject(config[first])) {
        throw new Error('Cannot assign config value, because inner path element points to a type that is not' +
            ' an object');
    }
    assignConfigOption(config[first], other.join('.'), value);
}
//# sourceMappingURL=configHelper.js.map