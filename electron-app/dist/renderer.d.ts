interface LoginFormElements extends HTMLFormElement {
    secret: HTMLInputElement;
    configPath: HTMLInputElement;
}
declare const loginForm: LoginFormElements;
declare const statusDiv: HTMLDivElement;
declare const connectedView: HTMLDivElement;
declare const loginBtn: HTMLButtonElement;
declare const logoutBtn: HTMLButtonElement;
declare const refreshBtn: HTMLButtonElement;
declare const wslStatusSpan: HTMLSpanElement;
declare const replicantStatusSpan: HTMLSpanElement;
declare let isConnected: boolean;
declare let statusCheckInterval: NodeJS.Timeout | null;
declare function showStatus(message: string, isError?: boolean): void;
declare function hideStatus(): void;
declare function updateStatus(): Promise<void>;
declare function startStatusUpdates(): void;
declare function stopStatusUpdates(): void;
//# sourceMappingURL=renderer.d.ts.map