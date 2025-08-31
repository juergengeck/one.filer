# Running the Electron App on Windows

Since this is a Windows desktop application, it needs to be run from Windows, not from WSL.

## Steps to run:

1. Open **Windows PowerShell** or **Command Prompt** (not WSL)

2. Navigate to the electron app directory:
   ```cmd
   cd C:\Users\juerg\source\one.filer\electron-app
   ```

3. Install dependencies (if not already done):
   ```cmd
   npm install
   ```

4. Build and start the app:
   ```cmd
   npm start
   ```

## Alternative: Build installer

To create a Windows installer:
```cmd
npm run build-win
```

The installer will be created in the `dist-app` directory.

## Note

The app will connect to the Replicant API running in WSL on `http://localhost:3000` (or whatever URL you specify).

Make sure the Replicant is running in WSL before trying to connect from the Electron app.