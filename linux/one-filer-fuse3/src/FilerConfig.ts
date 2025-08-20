/**
 * Filer Configuration Types and Defaults
 * 
 * @author REFINIO GmbH
 * @license SEE LICENSE IN LICENSE.md
 */

export interface FilerConfig {
    mountPoint: string;
    tmpDir?: string;
    logCalls: boolean;
    pairingUrl: string;
    iomMode: 'full' | 'light';
}

export const DefaultFilerConfig: FilerConfig = {
    mountPoint: '/tmp/one-filer',
    tmpDir: '/tmp/one-filer-tmp',
    logCalls: false,
    pairingUrl: 'https://app.leute.io',
    iomMode: 'light'
};