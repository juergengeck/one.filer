# Using one.leute.replicant with ONE Filer

This document explains how the adapted code works with one.leute.replicant.

## Architecture

The adaptation uses a **wrapper pattern** to support both:
1. The existing built-in Replicant implementation
2. The external one.leute.replicant package (when available)

## How it Works

1. **Package Detection**: The `ReplicantWrapper` tries to import `@refinio/one.leute.replicant`
2. **Automatic Selection**: If found, it uses one.leute.replicant; otherwise falls back to built-in
3. **Config Adaptation**: Translates between different config formats automatically
4. **API Compatibility**: Maintains the same API surface for both implementations

## Configuration

Add to your config to force using one.leute.replicant:
```json
{
  "useLeuteReplicant": true,
  "useFiler": true,
  "filerConfig": {
    "mountPoint": "/home/user/one-files"
  }
}
```

## Benefits

1. **No Breaking Changes**: Existing installations continue to work
2. **Gradual Migration**: Can test one.leute.replicant without commitment
3. **Single Codebase**: No need to maintain two separate projects
4. **Automatic Detection**: Works with or without one.leute.replicant installed

## Installation

To use one.leute.replicant:
1. Place `refinio-one.leute.replicant-latest.tgz` in the `vendor/` directory
2. Run `npm install`
3. Start normally - it will automatically detect and use one.leute.replicant

## Verification

Check which replicant is being used:
- Look for startup message: "✅ Using one.leute.replicant package"
- Or: "📦 one.leute.replicant not found, using built-in implementation"