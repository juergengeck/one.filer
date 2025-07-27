declare module '@OneCoreTypes' {
    // Basic ONE Core types for the filer application
    export type InstanceId = string;
    export type SHA256Hash = string;
    export type UnversionedObjectHash = string;
}

// Export as global types
declare global {
    namespace ONE {
        type InstanceId = string;
        type SHA256Hash = string;
        type UnversionedObjectHash = string;
    }
}

export {}; 