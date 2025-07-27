# ONE.Filer User Journeys

## Overview

ONE.Filer Desktop provides a native Windows experience for managing virtual drives that connect to ONE.core's content-addressed storage. Unlike the WSL/FUSE approach, this uses Windows ProjectedFS for seamless integration.

## Primary User Journeys

### 1. First-Time Setup

**Goal**: Install ONE.Filer and create first virtual drive

**Steps**:
1. **Download and Install**
   - Download ONE.Filer installer from website
   - Run installer (requires admin privileges)
   - Application launches automatically after installation

2. **Welcome Screen**
   - User sees welcome screen with brief explanation
   - "Get Started" button to create first drive

3. **Create First Drive**
   - Click "Create Virtual Drive" button
   - Enter drive name (e.g., "My Documents")
   - Select mount path (e.g., "C:\MyDrive")
   - Click "Create"

4. **Drive Activation**
   - Drive appears in dashboard as "Stopped"
   - Click "Start" button to activate
   - Windows Explorer opens showing empty drive

**Success Criteria**:
- Virtual drive visible in Windows Explorer
- Can create and access files
- System tray icon shows drive status

### 2. Daily Usage - Content Creator

**Goal**: Use virtual drive for daily work with automatic sync

**Morning Routine**:
1. **System Startup**
   - ONE.Filer starts with Windows (if enabled)
   - Drives auto-start based on settings
   - System tray shows running status

2. **Working with Files**
   - Open Windows Explorer
   - Navigate to virtual drive (e.g., C:\MyDrive)
   - Work with files normally:
     - Create new documents
     - Edit existing files
     - Organize in folders
   - All changes automatically stored in ONE.core

3. **Performance Monitoring**
   - Click system tray icon for quick stats
   - View dashboard for detailed metrics:
     - Files accessed: 47
     - Data transferred: 124 MB
     - Cache hit rate: 89%

**End of Day**:
- Files automatically synced
- Can stop drives manually or leave running
- Settings persist for next session

### 3. Multi-Device Sync Scenario

**Goal**: Access same content from multiple devices

**Setup Phase**:
1. **Primary Device**
   - Install ONE.Filer on main workstation
   - Create drive "Shared Projects"
   - Connect to ONE.core instance

2. **Secondary Device**
   - Install ONE.Filer on laptop
   - Connect to same ONE.core instance
   - Create drive with same content mapping

**Usage Flow**:
1. **Create on Desktop**
   - Create project files on desktop
   - Files instantly available in ONE.core

2. **Access on Laptop**
   - Open laptop hours later
   - Start ONE.Filer drive
   - Files appear in virtual drive
   - Continue working seamlessly

3. **Conflict Resolution**
   - CRDT handles concurrent edits
   - No sync conflicts
   - Version history available

### 4. Large Media Project

**Goal**: Work with large video/image files efficiently

**Workflow**:
1. **Project Setup**
   - Create dedicated drive "Video Projects"
   - Configure large cache (2GB)
   - Enable performance mode

2. **Import Media**
   - Copy video files to virtual drive
   - Files deduplicated automatically
   - Progress shown in dashboard

3. **Editing Workflow**
   - Open video editor (Premiere, DaVinci)
   - Work directly with files in virtual drive
   - Chunked reading ensures smooth playback
   - Only accessed portions cached

4. **Collaboration**
   - Team members connect to same ONE.core
   - Each has their own virtual drive
   - Changes propagate automatically

**Performance Features**:
- Smart caching of frequently used clips
- Background prefetching
- Bandwidth optimization

### 5. System Administrator

**Goal**: Deploy and manage ONE.Filer across organization

**Deployment**:
1. **MSI Package Creation**
   - Use provided MSI builder
   - Configure default settings
   - Include ONE.core connection details

2. **Group Policy Deployment**
   - Deploy via Active Directory
   - Configure per-machine installation
   - Set registry keys for auto-config

3. **User Provisioning**
   - Users log in to Windows
   - ONE.Filer auto-configures
   - Personal drive created at login

**Management**:
- Monitor usage via admin dashboard
- Set storage quotas per user
- Configure retention policies
- View aggregate statistics

### 6. Troubleshooting Journey

**Goal**: Resolve common issues

**Issue: Drive Won't Start**

1. **Check System Tray**
   - Right-click ONE.Filer icon
   - Select "Show Logs"
   - Look for error messages

2. **Verify Prerequisites**
   - Open Settings > Diagnostics
   - Run "System Check":
     - ✓ Windows version compatible
     - ✓ ProjectedFS enabled
     - ✗ Admin privileges missing

3. **Resolution**
   - Restart as administrator
   - Drive starts successfully
   - Enable "Run as Admin" in settings

**Issue: Poor Performance**

1. **Open Performance Monitor**
   - Dashboard > Performance tab
   - Notice low cache hit rate (12%)

2. **Adjust Settings**
   - Settings > Cache
   - Increase cache size to 500MB
   - Enable predictive caching

3. **Monitor Improvement**
   - Cache hit rate improves to 78%
   - File operations noticeably faster

## User Interface Flows

### Main Dashboard
```
┌─────────────────────────────────────┐
│  ONE.Filer - Virtual Drive Manager  │
├─────────────────────────────────────┤
│  ┌─────────┐ ┌─────────┐ ┌────────┐│
│  │ Total: 3│ │Running:2│ │Stopped:1││
│  └─────────┘ └─────────┘ └────────┘│
│                                     │
│  Active Drives:                     │
│  ┌─────────────────────────────┐   │
│  │ 📁 My Documents              │   │
│  │ Status: Running             │   │
│  │ Path: C:\MyDocs             │   │
│  │ Files: 1,247 | Size: 3.2GB │   │
│  │ [Stop] [Open] [Settings]   │   │
│  └─────────────────────────────┘   │
│                                     │
│  Performance:                       │
│  Cache Hit Rate: ████████░░ 84%    │
│  Network I/O:    ██░░░░░░░░ 23MB/s │
└─────────────────────────────────────┘
```

### Create Drive Modal
```
┌─────────────────────────────────────┐
│        Create Virtual Drive         │
├─────────────────────────────────────┤
│                                     │
│  Drive Name:                        │
│  ┌─────────────────────────────┐   │
│  │ My Project Files            │   │
│  └─────────────────────────────┘   │
│                                     │
│  Mount Path:                        │
│  ┌─────────────────┬──────────┐   │
│  │ C:\ProjectDrive │ [Browse] │   │
│  └─────────────────┴──────────┘   │
│                                     │
│  ⓘ This folder will become a       │
│    virtual drive connected to       │
│    ONE.core storage                 │
│                                     │
│  [Cancel]          [Create Drive]   │
└─────────────────────────────────────┘
```

### System Tray Menu
```
┌─────────────────────────┐
│ 💾 ONE.Filer           │
├─────────────────────────┤
│ > My Documents (Running)│
│ > Projects (Running)    │
│ > Archive (Stopped)     │
├─────────────────────────┤
│ Start All Drives        │
│ Stop All Drives         │
├─────────────────────────┤
│ Settings               │
│ About                  │
│ Quit                   │
└─────────────────────────┘
```

## Key Differentiators from WSL/FUSE

1. **Native Windows Experience**
   - No WSL required
   - No command line needed
   - Works with all Windows applications

2. **Better Performance**
   - Direct kernel integration via ProjFS
   - Lower latency than WSL bridge
   - Native NTFS attributes

3. **Easier Deployment**
   - Standard Windows installer
   - Group Policy support
   - No Linux knowledge required

4. **Enhanced Security**
   - Windows ACLs respected
   - BitLocker compatible
   - Audit trail support

5. **User-Friendly Management**
   - GUI for all operations
   - Visual performance monitoring
   - Integrated troubleshooting

## Success Metrics

- **Installation**: < 2 minutes from download to first drive
- **Drive Creation**: < 30 seconds per drive
- **File Access**: < 50ms latency for cached files
- **Learning Curve**: Users productive within 10 minutes
- **Support Tickets**: 90% reduction vs WSL approach