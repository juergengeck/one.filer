import { test, expect, _electron as electron } from '@playwright/test';
import { ElectronApplication, Page } from '@playwright/test';
import path from 'path';

let electronApp: ElectronApplication;
let page: Page;

test.beforeAll(async () => {
    // Launch Electron app
    electronApp = await electron.launch({
        args: [path.join(__dirname, '../../dist/main/main.js')]
    });
    
    // Get the first window
    page = await electronApp.firstWindow();
});

test.afterAll(async () => {
    await electronApp.close();
});

test.describe('ONE.Filer Desktop App', () => {
    test('should display main window', async () => {
        const title = await page.title();
        expect(title).toBe('ONE.Filer - Virtual Drive Manager');
    });

    test('should show dashboard on startup', async () => {
        await expect(page.locator('h1')).toContainText('ONE.Filer Dashboard');
        await expect(page.locator('.stats-overview')).toBeVisible();
    });

    test('should navigate between sections', async () => {
        // Navigate to Drives
        await page.click('nav >> text=Drives');
        await expect(page.locator('h1')).toContainText('Virtual Drives');
        
        // Navigate to Settings
        await page.click('nav >> text=Settings');
        await expect(page.locator('h1')).toContainText('Settings');
        
        // Back to Dashboard
        await page.click('nav >> text=Dashboard');
        await expect(page.locator('h1')).toContainText('ONE.Filer Dashboard');
    });

    test('should open create drive modal', async () => {
        await page.click('nav >> text=Drives');
        await page.click('button >> text=New Drive');
        
        await expect(page.locator('.modal')).toBeVisible();
        await expect(page.locator('.modal h2')).toContainText('Create Virtual Drive');
    });

    test('should validate create drive form', async () => {
        await page.click('nav >> text=Drives');
        await page.click('button >> text=New Drive');
        
        // Try to create without filling form
        const createButton = page.locator('.modal button >> text=Create Drive');
        await expect(createButton).toBeDisabled();
        
        // Fill name
        await page.fill('#drive-name', 'Test Drive');
        await expect(createButton).toBeDisabled(); // Still need path
        
        // Fill path
        await page.fill('#drive-path', 'C:\\TestDrive');
        await expect(createButton).toBeEnabled();
        
        // Close modal
        await page.click('.modal button >> text=Cancel');
        await expect(page.locator('.modal')).not.toBeVisible();
    });
});

test.describe('Drive Management', () => {
    test('should create a new drive', async () => {
        await page.click('nav >> text=Drives');
        
        const initialDriveCount = await page.locator('.drive-list-item').count();
        
        // Create new drive
        await page.click('button >> text=New Drive');
        await page.fill('#drive-name', 'E2E Test Drive');
        await page.fill('#drive-path', 'C:\\E2ETestDrive');
        await page.click('.modal button >> text=Create Drive');
        
        // Wait for modal to close
        await expect(page.locator('.modal')).not.toBeVisible();
        
        // Check drive was added
        const newDriveCount = await page.locator('.drive-list-item').count();
        expect(newDriveCount).toBe(initialDriveCount + 1);
        
        // Verify drive details
        await expect(page.locator('text=E2E Test Drive')).toBeVisible();
        await expect(page.locator('text=C:\\E2ETestDrive')).toBeVisible();
    });

    test('should start and stop a drive', async () => {
        await page.click('nav >> text=Drives');
        
        // Find test drive
        const driveItem = page.locator('.drive-list-item', { hasText: 'E2E Test Drive' });
        
        // Start drive
        await driveItem.locator('button >> text=Start').click();
        await expect(driveItem.locator('.status-badge')).toContainText('Running');
        await expect(driveItem.locator('button >> text=Stop')).toBeVisible();
        
        // Stop drive
        await driveItem.locator('button >> text=Stop').click();
        await expect(driveItem.locator('.status-badge')).toContainText('Stopped');
        await expect(driveItem.locator('button >> text=Start')).toBeVisible();
    });

    test('should show drive statistics when running', async () => {
        await page.click('nav >> text=Drives');
        
        const driveItem = page.locator('.drive-list-item', { hasText: 'E2E Test Drive' });
        
        // Start drive
        await driveItem.locator('button >> text=Start').click();
        
        // Go to dashboard
        await page.click('nav >> text=Dashboard');
        
        // Check that running drive appears in active drives
        await expect(page.locator('.drives-grid')).toContainText('E2E Test Drive');
        
        // Verify stats are shown
        const driveCard = page.locator('.drive-card', { hasText: 'E2E Test Drive' });
        await expect(driveCard.locator('.stat-item')).toHaveCount(4); // Should show various stats
    });

    test('should delete a drive', async () => {
        await page.click('nav >> text=Drives');
        
        const driveItem = page.locator('.drive-list-item', { hasText: 'E2E Test Drive' });
        
        // Make sure drive is stopped
        if (await driveItem.locator('button >> text=Stop').isVisible()) {
            await driveItem.locator('button >> text=Stop').click();
        }
        
        // Delete drive
        await driveItem.locator('button[aria-label="Delete drive"]').click();
        
        // Confirm deletion
        await page.click('.confirm-dialog button >> text=Delete');
        
        // Verify drive is removed
        await expect(page.locator('text=E2E Test Drive')).not.toBeVisible();
    });
});

test.describe('Settings', () => {
    test('should save settings', async () => {
        await page.click('nav >> text=Settings');
        
        // Toggle auto-start
        const autoStartToggle = page.locator('input[name="autoStart"]');
        const initialState = await autoStartToggle.isChecked();
        await autoStartToggle.click();
        
        // Toggle minimize to tray
        const trayToggle = page.locator('input[name="minimizeToTray"]');
        await trayToggle.click();
        
        // Navigate away and back
        await page.click('nav >> text=Dashboard');
        await page.click('nav >> text=Settings');
        
        // Verify settings persisted
        expect(await autoStartToggle.isChecked()).toBe(!initialState);
    });

    test('should change theme', async () => {
        await page.click('nav >> text=Settings');
        
        // Select dark theme
        await page.selectOption('select[name="theme"]', 'dark');
        
        // Verify theme applied
        await expect(page.locator('body')).toHaveClass(/theme-dark/);
        
        // Select light theme
        await page.selectOption('select[name="theme"]', 'light');
        await expect(page.locator('body')).toHaveClass(/theme-light/);
    });
});

test.describe('System Tray', () => {
    test('should minimize to tray', async () => {
        // Enable minimize to tray
        await page.click('nav >> text=Settings');
        await page.check('input[name="minimizeToTray"]');
        
        // Get window state
        const window = await electronApp.browserWindow(page);
        
        // Close window
        await window.close();
        
        // Window should be hidden, not closed
        expect(await window.isVisible()).toBe(false);
        
        // App should still be running
        expect(electronApp.process().killed).toBe(false);
    });
});