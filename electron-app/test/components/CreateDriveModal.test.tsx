import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CreateDriveModal } from '../../src/renderer/components/CreateDriveModal';

// Mock electron API
global.window.electronAPI = {
    dialog: {
        selectFolder: vi.fn()
    }
} as any;

describe('CreateDriveModal', () => {
    const mockOnClose = vi.fn();
    const mockOnCreate = vi.fn();

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should render modal with form fields', () => {
        render(
            <CreateDriveModal 
                onClose={mockOnClose} 
                onCreate={mockOnCreate} 
            />
        );

        expect(screen.getByText('Create Virtual Drive')).toBeInTheDocument();
        expect(screen.getByLabelText(/Drive Name/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/Mount Path/i)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Browse/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Create Drive/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Cancel/i })).toBeInTheDocument();
    });

    it('should close modal when clicking overlay', () => {
        render(
            <CreateDriveModal 
                onClose={mockOnClose} 
                onCreate={mockOnCreate} 
            />
        );

        const overlay = screen.getByTestId('modal-overlay');
        fireEvent.click(overlay);

        expect(mockOnClose).toHaveBeenCalled();
    });

    it('should close modal when clicking X button', () => {
        render(
            <CreateDriveModal 
                onClose={mockOnClose} 
                onCreate={mockOnCreate} 
            />
        );

        const closeButton = screen.getByRole('button', { name: /close/i });
        fireEvent.click(closeButton);

        expect(mockOnClose).toHaveBeenCalled();
    });

    it('should validate empty name', async () => {
        const user = userEvent.setup();
        
        render(
            <CreateDriveModal 
                onClose={mockOnClose} 
                onCreate={mockOnCreate} 
            />
        );

        // Fill only path
        const pathInput = screen.getByLabelText(/Mount Path/i);
        await user.type(pathInput, 'C:\\TestDrive');

        // Try to create
        const createButton = screen.getByRole('button', { name: /Create Drive/i });
        await user.click(createButton);

        expect(screen.getByText('Please enter a drive name')).toBeInTheDocument();
        expect(mockOnCreate).not.toHaveBeenCalled();
    });

    it('should validate empty path', async () => {
        const user = userEvent.setup();
        
        render(
            <CreateDriveModal 
                onClose={mockOnClose} 
                onCreate={mockOnCreate} 
            />
        );

        // Fill only name
        const nameInput = screen.getByLabelText(/Drive Name/i);
        await user.type(nameInput, 'Test Drive');

        // Try to create
        const createButton = screen.getByRole('button', { name: /Create Drive/i });
        await user.click(createButton);

        expect(screen.getByText('Please select a folder path')).toBeInTheDocument();
        expect(mockOnCreate).not.toHaveBeenCalled();
    });

    it('should call onCreate with form data', async () => {
        const user = userEvent.setup();
        mockOnCreate.mockResolvedValue(undefined);
        
        render(
            <CreateDriveModal 
                onClose={mockOnClose} 
                onCreate={mockOnCreate} 
            />
        );

        // Fill form
        const nameInput = screen.getByLabelText(/Drive Name/i);
        const pathInput = screen.getByLabelText(/Mount Path/i);
        
        await user.type(nameInput, 'Test Drive');
        await user.type(pathInput, 'C:\\TestDrive');

        // Create drive
        const createButton = screen.getByRole('button', { name: /Create Drive/i });
        await user.click(createButton);

        expect(mockOnCreate).toHaveBeenCalledWith({
            name: 'Test Drive',
            path: 'C:\\TestDrive'
        });
    });

    it('should trim whitespace from name', async () => {
        const user = userEvent.setup();
        mockOnCreate.mockResolvedValue(undefined);
        
        render(
            <CreateDriveModal 
                onClose={mockOnClose} 
                onCreate={mockOnCreate} 
            />
        );

        // Fill form with whitespace
        const nameInput = screen.getByLabelText(/Drive Name/i);
        const pathInput = screen.getByLabelText(/Mount Path/i);
        
        await user.type(nameInput, '  Test Drive  ');
        await user.type(pathInput, 'C:\\TestDrive');

        // Create drive
        const createButton = screen.getByRole('button', { name: /Create Drive/i });
        await user.click(createButton);

        expect(mockOnCreate).toHaveBeenCalledWith({
            name: 'Test Drive',
            path: 'C:\\TestDrive'
        });
    });

    it('should open folder browser', async () => {
        const user = userEvent.setup();
        window.electronAPI.dialog.selectFolder = vi.fn().mockResolvedValue('C:\\SelectedFolder');
        
        render(
            <CreateDriveModal 
                onClose={mockOnClose} 
                onCreate={mockOnCreate} 
            />
        );

        const browseButton = screen.getByRole('button', { name: /Browse/i });
        await user.click(browseButton);

        expect(window.electronAPI.dialog.selectFolder).toHaveBeenCalled();
        
        await waitFor(() => {
            const pathInput = screen.getByLabelText(/Mount Path/i) as HTMLInputElement;
            expect(pathInput.value).toBe('C:\\SelectedFolder');
        });
    });

    it('should auto-generate name from selected path', async () => {
        const user = userEvent.setup();
        window.electronAPI.dialog.selectFolder = vi.fn().mockResolvedValue('C:\\MyDocuments');
        
        render(
            <CreateDriveModal 
                onClose={mockOnClose} 
                onCreate={mockOnCreate} 
            />
        );

        const browseButton = screen.getByRole('button', { name: /Browse/i });
        await user.click(browseButton);

        await waitFor(() => {
            const nameInput = screen.getByLabelText(/Drive Name/i) as HTMLInputElement;
            expect(nameInput.value).toBe('MyDocuments Drive');
        });
    });

    it('should not override existing name when selecting path', async () => {
        const user = userEvent.setup();
        window.electronAPI.dialog.selectFolder = vi.fn().mockResolvedValue('C:\\MyDocuments');
        
        render(
            <CreateDriveModal 
                onClose={mockOnClose} 
                onCreate={mockOnCreate} 
            />
        );

        // Set name first
        const nameInput = screen.getByLabelText(/Drive Name/i);
        await user.type(nameInput, 'Custom Name');

        // Then select path
        const browseButton = screen.getByRole('button', { name: /Browse/i });
        await user.click(browseButton);

        // Name should not change
        expect((nameInput as HTMLInputElement).value).toBe('Custom Name');
    });

    it('should show loading state while creating', async () => {
        const user = userEvent.setup();
        
        // Mock onCreate to not resolve immediately
        let resolveCreate: () => void;
        mockOnCreate.mockReturnValue(new Promise(resolve => {
            resolveCreate = resolve;
        }));
        
        render(
            <CreateDriveModal 
                onClose={mockOnClose} 
                onCreate={mockOnCreate} 
            />
        );

        // Fill form
        const nameInput = screen.getByLabelText(/Drive Name/i);
        const pathInput = screen.getByLabelText(/Mount Path/i);
        
        await user.type(nameInput, 'Test Drive');
        await user.type(pathInput, 'C:\\TestDrive');

        // Create drive
        const createButton = screen.getByRole('button', { name: /Create Drive/i });
        await user.click(createButton);

        // Should show loading state
        expect(screen.getByRole('button', { name: /Creating.../i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Cancel/i })).toBeDisabled();
        
        // Resolve the promise
        resolveCreate!();
        
        await waitFor(() => {
            expect(mockOnClose).not.toHaveBeenCalled(); // Modal closes after successful creation
        });
    });

    it('should show error message on creation failure', async () => {
        const user = userEvent.setup();
        mockOnCreate.mockRejectedValue(new Error('Failed to create drive'));
        
        render(
            <CreateDriveModal 
                onClose={mockOnClose} 
                onCreate={mockOnCreate} 
            />
        );

        // Fill form
        const nameInput = screen.getByLabelText(/Drive Name/i);
        const pathInput = screen.getByLabelText(/Mount Path/i);
        
        await user.type(nameInput, 'Test Drive');
        await user.type(pathInput, 'C:\\TestDrive');

        // Create drive
        const createButton = screen.getByRole('button', { name: /Create Drive/i });
        await user.click(createButton);

        await waitFor(() => {
            expect(screen.getByText('Failed to create drive')).toBeInTheDocument();
        });
        
        // Modal should remain open
        expect(mockOnClose).not.toHaveBeenCalled();
    });
});