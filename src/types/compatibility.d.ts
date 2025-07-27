/**
 * Type compatibility fixes for mismatched versions between one.core and one.models
 */
export type SHA256Hash<T = any> = any;
export type SHA256IdHash<T = any> = any;
export interface ErrorWithCode extends Error {
    code: string;
}
export declare const HashTypes: {
    readonly SHA256: "sha256";
};
export type HashType = typeof HashTypes[keyof typeof HashTypes];
//# sourceMappingURL=compatibility.d.ts.map