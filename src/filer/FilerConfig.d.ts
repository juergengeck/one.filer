export interface FilerConfig {
    readonly mountPoint: string;
    readonly pairingUrl: string;
    readonly iomMode: 'full' | 'light';
    readonly logCalls: boolean;
    readonly fuseOptions?: Record<string, any>;
}
export declare const DefaultFilerConfig: FilerConfig;
export declare function checkFilerConfig(config: unknown): Partial<FilerConfig>;
//# sourceMappingURL=FilerConfig.d.ts.map