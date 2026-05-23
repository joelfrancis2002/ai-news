# Deprecated Frontend Auth Helpers

This folder contains unused auth helpers from an unfinished Axios-based auth flow.

## Archived files

- `axios-client.ts`: Axios client with refresh-token interceptor logic
- `storage.ts`: Token/session storage helpers used only by the Axios client

## Why they were archived

- The active web app uses `apps/web/src/lib/apiClient.ts`
- No active frontend module imported these files
- Keeping them under `src/` created confusion and unnecessary search noise
