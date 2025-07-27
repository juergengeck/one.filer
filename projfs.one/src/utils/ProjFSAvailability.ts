import { execSync } from 'child_process';
import { platform, release } from 'os';

/**
 * Check if ProjFS is available on the current system
 */
export class ProjFSAvailability {
    /**
     * Check if the system meets all requirements for ProjFS
     */
    static async isAvailable(): Promise<{
        available: boolean;
        reason?: string;
        details?: {
            isWindows: boolean;
            windowsVersion?: string;
            featureEnabled?: boolean;
            apiAvailable?: boolean;
        };
    }> {
        // Check if running on Windows
        if (platform() !== 'win32') {
            return {
                available: false,
                reason: 'ProjFS is only available on Windows',
                details: {
                    isWindows: false
                }
            };
        }

        const details: any = {
            isWindows: true
        };

        try {
            // Get Windows version
            const version = release();
            details.windowsVersion = version;
            
            // Parse version to check if >= Windows 10 1809 (10.0.17763)
            const versionParts = version.split('.');
            const major = parseInt(versionParts[0] || '0');
            const minor = parseInt(versionParts[1] || '0');
            const build = parseInt(versionParts[2] || '0');
            
            if (major < 10 || (major === 10 && build < 17763)) {
                return {
                    available: false,
                    reason: 'ProjFS requires Windows 10 version 1809 (build 17763) or later',
                    details
                };
            }

            // Check if ProjFS feature is enabled
            try {
                const featureCheck = execSync(
                    'powershell -Command "Get-WindowsOptionalFeature -Online -FeatureName Client-ProjFS | Select-Object -ExpandProperty State"',
                    { encoding: 'utf8' }
                ).trim();
                
                details.featureEnabled = featureCheck === 'Enabled';
                
                if (!details.featureEnabled) {
                    return {
                        available: false,
                        reason: 'ProjFS optional feature is not enabled. Enable it with: Enable-WindowsOptionalFeature -Online -FeatureName Client-ProjFS',
                        details
                    };
                }
            } catch (error) {
                // Feature check failed - might be on older Windows
                details.featureEnabled = false;
                return {
                    available: false,
                    reason: 'Could not check ProjFS feature status',
                    details
                };
            }

            // Check if ProjFS API is available by trying to load the native module
            try {
                // Try to dynamically check if projfscli.dll exists
                const dllCheck = execSync(
                    'powershell -Command "Test-Path -Path C:\\Windows\\System32\\projfscli.dll"',
                    { encoding: 'utf8' }
                ).trim();
                
                details.apiAvailable = dllCheck === 'True';
                
                if (!details.apiAvailable) {
                    return {
                        available: false,
                        reason: 'ProjFS API (projfscli.dll) not found',
                        details
                    };
                }
            } catch (error) {
                details.apiAvailable = false;
                return {
                    available: false,
                    reason: 'Could not verify ProjFS API availability',
                    details
                };
            }

            // All checks passed
            return {
                available: true,
                details
            };
            
        } catch (error) {
            return {
                available: false,
                reason: `Unexpected error checking ProjFS availability: ${error}`,
                details
            };
        }
    }

    /**
     * Enable ProjFS feature (requires admin privileges)
     */
    static async enableFeature(): Promise<{ success: boolean; error?: string }> {
        if (platform() !== 'win32') {
            return { success: false, error: 'Can only enable ProjFS on Windows' };
        }

        try {
            execSync(
                'powershell -Command "Enable-WindowsOptionalFeature -Online -FeatureName Client-ProjFS -NoRestart"',
                { encoding: 'utf8', stdio: 'inherit' }
            );
            return { success: true };
        } catch (error) {
            return { 
                success: false, 
                error: `Failed to enable ProjFS: ${error}. Make sure to run as administrator.` 
            };
        }
    }

    /**
     * Get detailed system information for troubleshooting
     */
    static async getSystemInfo(): Promise<any> {
        const info: any = {
            platform: platform(),
            release: release(),
            projfsAvailable: false
        };

        if (platform() === 'win32') {
            try {
                // Get Windows edition
                info.windowsEdition = execSync(
                    'powershell -Command "(Get-WmiObject -class Win32_OperatingSystem).Caption"',
                    { encoding: 'utf8' }
                ).trim();

                // Get build number
                info.buildNumber = execSync(
                    'powershell -Command "(Get-ItemProperty -Path \"HKLM:\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\").CurrentBuild"',
                    { encoding: 'utf8' }
                ).trim();

                // Check ProjFS registry entries
                try {
                    info.projfsRegistered = execSync(
                        'powershell -Command "Test-Path -Path \"HKLM:\\SYSTEM\\CurrentControlSet\\Services\\PrjFlt\""',
                        { encoding: 'utf8' }
                    ).trim() === 'True';
                } catch {
                    info.projfsRegistered = false;
                }
            } catch (error) {
                info.error = `Failed to get system info: ${error}`;
            }
        }

        const availability = await this.isAvailable();
        info.projfsAvailable = availability.available;
        info.projfsDetails = availability.details;

        return info;
    }
}
