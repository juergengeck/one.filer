import React from 'react';
interface CreateDriveModalProps {
    onClose: () => void;
    onCreate: (config: {
        name: string;
        path: string;
    }) => Promise<void>;
}
export declare function CreateDriveModal({ onClose, onCreate }: CreateDriveModalProps): React.JSX.Element;
export {};
//# sourceMappingURL=CreateDriveModal.d.ts.map