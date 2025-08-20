/**
 * Configuration Helper Utilities
 * 
 * @author REFINIO GmbH
 * @license SEE LICENSE IN LICENSE.md
 */

import fs from 'fs/promises';
import path from 'path';

/**
 * Fill missing configuration values with defaults
 * 
 * @param config - Partial configuration
 * @param defaults - Default configuration
 * @returns Merged configuration
 */
export function fillMissingWithDefaults<T>(config: Partial<T>, defaults: T): T {
    const result = { ...defaults };
    
    for (const key in config) {
        if (config[key] !== undefined) {
            if (typeof config[key] === 'object' && !Array.isArray(config[key]) && config[key] !== null) {
                // Recursively merge objects
                result[key] = fillMissingWithDefaults(
                    config[key] as any,
                    defaults[key] as any
                );
            } else {
                result[key] = config[key] as any;
            }
        }
    }
    
    return result;
}

/**
 * Read JSON file or return empty object
 * 
 * @param filePath - Path to JSON file
 * @returns Parsed JSON or empty object
 */
export async function readJsonFileOrEmpty(filePath: string): Promise<any> {
    try {
        const content = await fs.readFile(filePath, 'utf-8');
        return JSON.parse(content);
    } catch {
        return {};
    }
}

/**
 * Write JSON file
 * 
 * @param filePath - Path to JSON file
 * @param data - Data to write
 */
export async function writeJsonFile(filePath: string, data: any): Promise<void> {
    const dir = path.dirname(filePath);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(filePath, JSON.stringify(data, null, 2));
}

/**
 * Assign configuration option with nested path support
 * 
 * @param config - Configuration object
 * @param path - Dot-separated path (e.g., "filer.mountPoint")
 * @param value - Value to assign
 */
export function assignConfigOption(config: any, path: string, value: any): void {
    if (value === undefined) return;
    
    const parts = path.split('.');
    let current = config;
    
    for (let i = 0; i < parts.length - 1; i++) {
        const part = parts[i];
        if (!(part in current)) {
            current[part] = {};
        }
        current = current[part];
    }
    
    current[parts[parts.length - 1]] = value;
}