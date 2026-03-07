# Arduino Workbench API Contracts

**Status:** Draft (updated)  
**Date:** February 28, 2026 (updated March 5, 2026)  
**Scope:** Planning/specification only

## 1. Conventions
1. Base path: `/api/projects/:id/arduino`
2. Auth: existing `X-Session-Id` header model.
3. Ownership: request must pass project ownership checks.
4. Content type: `application/json` except SSE routes.
5. Job-creating endpoints accept optional `X-Idempotency-Key` header.

### 1.1 Error Envelope
All non-2xx responses use:
```json
{
  "message": "Human readable error",
  "code": "OPTIONAL_MACHINE_CODE",
  "details": {}
}
```

### 1.2 Job Status Enum
```text
pending | running | completed | failed | cancelled
```

### 1.3 Timestamp Format
All timestamps are ISO-8601 UTC strings.

### 1.4 Default Operational Limits
1. Max workspace file write payload: 1 MiB.
2. Max persisted job log size per job: 2 MiB (oldest log chunks truncated).
3. SSE inactivity timeout: 120 seconds.
4. SSE absolute timeout: 300 seconds.

## 2. Shared Types

### 2.1 BoardPort
```json
{
  "address": "/dev/ttyUSB0",
  "label": "USB Serial",
  "protocol": "serial",
  "boardName": "ESP32 Dev Module",
  "fqbn": "esp32:esp32:esp32"
}
```

### 2.2 BuildProfile
```json
{
  "id": 12,
  "projectId": 1,
  "name": "ESP32 Debug",
  "profileName": "esp32_debug",
  "fqbn": "esp32:esp32:esp32",
  "port": "/dev/ttyUSB0",
  "protocol": "serial",
  "boardOptions": {
    "FlashMode": "qio",
    "PartitionScheme": "default"
  },
  "portConfig": {
    "baudrate": "115200"
  },
  "libOverrides": {
    "ArduinoJson": "/opt/libs/ArduinoJson-7.0.3"
  },
  "verboseCompile": true,
  "verboseUpload": true,
  "isDefault": true,
  "createdAt": "2026-02-28T09:10:00.000Z",
  "updatedAt": "2026-02-28T09:10:00.000Z"
}
```

### 2.3 ArduinoJob
```json
{
  "id": 94,
  "projectId": 1,
  "profileId": 12,
  "jobType": "compile",
  "status": "running",
  "startedAt": "2026-02-28T09:20:00.000Z",
  "finishedAt": null,
  "exitCode": null,
  "summary": "Compiling sketch",
  "errorCode": null
}
```

### 2.4 ArduinoWorkspaceFile
```json
{
  "path": "sketches/main/main.ino",
  "language": "cpp",
  "size": 1520,
  "updatedAt": "2026-02-28T09:00:00.000Z"
}
```

## 3. Health Endpoint

### 3.1 GET `/health`
Purpose: preflight checks before user actions.

Response `200`:
```json
{
  "ok": true,
  "cli": {
    "path": "/usr/bin/arduino-cli",
    "version": "1.2.0"
  },
  "directories": {
    "dataDir": "/var/lib/protopulse/arduino-data",
    "sketchRoot": "/var/lib/protopulse/arduino-sketches"
  }
}
```

Response `503` (example):
```json
{
  "message": "Arduino CLI is not available",
  "code": "ARDUINO_CLI_NOT_FOUND"
}
```

## 4. Workspace Endpoints

### 4.1 GET `/workspace`
Returns workspace metadata, file tree, and active profile reference.

Response `200`:
```json
{
  "workspace": {
    "rootPath": "projects/1/arduino",
    "activeSketchPath": "sketches/main/main.ino"
  },
  "files": [
    {
      "path": "sketches/main/main.ino",
      "language": "cpp",
      "size": 1520,
      "updatedAt": "2026-02-28T09:00:00.000Z"
    }
  ],
  "activeProfileId": 12
}
```

### 4.2 GET `/workspace/files?path=...`
Read file content.

Response `200`:
```json
{
  "path": "sketches/main/main.ino",
  "content": "void setup(){}\nvoid loop(){}",
  "language": "cpp",
  "updatedAt": "2026-02-28T09:21:00.000Z"
}
```

### 4.3 PUT `/workspace/files`
Create or update file content.

Request:
```json
{
  "path": "sketches/main/main.ino",
  "content": "void setup(){}\nvoid loop(){}",
  "language": "cpp"
}
```

Response `200`:
```json
{
  "path": "sketches/main/main.ino",
  "updatedAt": "2026-02-28T09:21:00.000Z"
}
```

### 4.4 DELETE `/workspace/files?path=...`
Delete a file by path. Query param is used to avoid DELETE-body interoperability issues.

Response `204`: empty

### 4.5 POST `/workspace/format`
Format source.

Request:
```json
{
  "path": "sketches/main/main.ino",
  "content": "int x=1;"
}
```

Response `200`:
```json
{
  "formatted": "int x = 1;\n"
}
```

### 4.6 POST `/workspace/attach`
Attach defaults/profile mapping to workspace (`sketch.yaml` alignment helper).

Request:
```json
{
  "fqbn": "esp32:esp32:esp32",
  "port": "/dev/ttyUSB0",
  "protocol": "serial",
  "profileName": "esp32_debug",
  "setAsDefault": true
}
```

Response `200`:
```json
{
  "attached": true,
  "profileId": 12
}
```

## 5. Boards and Platforms

### 5.1 GET `/boards/discover`
Response `200`:
```json
{
  "ports": [
    {
      "address": "/dev/ttyUSB0",
      "label": "USB Serial",
      "protocol": "serial",
      "boardName": "ESP32 Dev Module",
      "fqbn": "esp32:esp32:esp32"
    }
  ],
  "lastRefreshedAt": "2026-02-28T09:21:30.000Z"
}
```

### 5.2 GET `/boards/platforms`
Response `200`:
```json
{
  "platforms": [
    {
      "id": "esp32:esp32",
      "installedVersion": "3.2.0",
      "latestVersion": "3.2.1",
      "updatable": true
    }
  ]
}
```

### 5.3 POST `/boards/platforms/install`
Request:
```json
{
  "platformId": "esp32:esp32",
  "version": "3.2.1"
}
```

Response `202`:
```json
{
  "jobId": 101,
  "status": "pending"
}
```

### 5.4 POST `/boards/platforms/upgrade`
Request:
```json
{
  "platformId": "esp32:esp32"
}
```

Response `202`:
```json
{
  "jobId": 102,
  "status": "pending"
}
```

## 6. Library Endpoints

### 6.1 GET `/libraries?query=wifi&installed=true`
Response `200`:
```json
{
  "libraries": [
    {
      "name": "WiFi",
      "author": "Arduino",
      "version": "1.2.7",
      "installed": true,
      "sentence": "WiFi support library"
    }
  ]
}
```

### 6.2 POST `/libraries/update-index`
Response `202`:
```json
{
  "jobId": 103,
  "status": "pending"
}
```

### 6.3 POST `/libraries/install`
Request:
```json
{
  "name": "ArduinoJson",
  "version": "7.0.3"
}
```

Response `202`:
```json
{
  "jobId": 104,
  "status": "pending"
}
```

### 6.4 DELETE `/libraries/:name`
Response `202`:
```json
{
  "jobId": 105,
  "status": "pending"
}
```

## 7. Build Profile Endpoints

### 7.1 GET `/profiles`
Response `200`:
```json
{
  "profiles": [
    {
      "id": 12,
      "projectId": 1,
      "name": "ESP32 Debug",
      "profileName": "esp32_debug",
      "fqbn": "esp32:esp32:esp32",
      "port": "/dev/ttyUSB0",
      "protocol": "serial",
      "boardOptions": {},
      "portConfig": { "baudrate": "115200" },
      "libOverrides": {},
      "verboseCompile": true,
      "verboseUpload": true,
      "isDefault": true,
      "createdAt": "2026-02-28T09:10:00.000Z",
      "updatedAt": "2026-02-28T09:10:00.000Z"
    }
  ]
}
```

### 7.2 POST `/profiles`
Request:
```json
{
  "name": "UNO Release",
  "profileName": "uno_release",
  "fqbn": "arduino:avr:uno",
  "port": "/dev/ttyACM0",
  "protocol": "serial",
  "boardOptions": {},
  "portConfig": { "baudrate": "115200" },
  "libOverrides": {},
  "verboseCompile": false,
  "verboseUpload": false,
  "isDefault": false
}
```

Response `201`:
```json
{
  "id": 15
}
```

### 7.3 PATCH `/profiles/:profileId`
Response `200`: updated `BuildProfile`

### 7.4 DELETE `/profiles/:profileId`
Response `204`: empty

## 8. Compile and Upload Job Endpoints

### 8.1 POST `/jobs/compile`
Request:
```json
{
  "profileId": 12,
  "sketchPath": "sketches/main",
  "verbose": true
}
```

Response `202`:
```json
{
  "jobId": 94,
  "status": "pending"
}
```

Notes:
1. Optional header: `X-Idempotency-Key`.
2. Duplicate idempotency key for same project/job type within 5 minutes should return the existing job record.

### 8.2 POST `/jobs/upload`
Request:
```json
{
  "profileId": 12,
  "sketchPath": "sketches/main",
  "verify": false,
  "verbose": true
}
```

Response `202`:
```json
{
  "jobId": 95,
  "status": "pending"
}
```

Notes:
1. Upload queue is serialized per `projectId+port`.
2. If a conflicting upload is already running on the same port, server returns `409` with `PORT_BUSY`.

### 8.3 GET `/jobs/:jobId`
Response `200`: `ArduinoJob`

### 8.4 GET `/jobs/:jobId/logs` (SSE)
SSE event types:
1. `log` -> line chunk
2. `status` -> lifecycle update
3. `done` -> final state
4. comment heartbeat (`:heartbeat`) every 15s while stream is open

`status` event payload example:
```json
{
  "jobId": 95,
  "status": "running",
  "summary": "Uploading sketch"
}
```

### 8.5 POST `/jobs/:jobId/cancel`
Response `200`:
```json
{
  "status": "cancelled"
}
```

## 9. Serial Endpoints

### 9.1 POST `/serial/open`
Request:
```json
{
  "port": "/dev/ttyUSB0",
  "protocol": "serial",
  "baudRate": 115200,
  "timestamp": true,
  "delimiter": "\\n"
}
```

Response `201`:
```json
{
  "sessionId": 40,
  "status": "open"
}
```

### 9.2 POST `/serial/write`
Request:
```json
{
  "sessionId": 40,
  "payload": "LED ON\\n"
}
```

Response `204`: empty

### 9.3 GET `/serial/stream?sessionId=40` (SSE)
SSE event types:
1. `data` -> serial payload
2. `status` -> open/closed/error update
3. `error` -> structured failure event
4. comment heartbeat (`:heartbeat`) every 15s while stream is open

`data` event payload example:
```json
{
  "sessionId": 40,
  "timestamp": "2026-02-28T10:12:04.000Z",
  "payload": "Hello from device"
}
```

### 9.4 POST `/serial/close`
Request:
```json
{
  "sessionId": 40
}
```

Response `204`: empty

## 10. Phased Endpoints (P3+)

### 10.1 GET `/cloud/status`
```json
{
  "connected": false,
  "provider": "arduino-cloud"
}
```

### 10.2 POST `/cloud/pull`
```json
{
  "remotePath": "my-sketches/device-a"
}
```

### 10.3 POST `/cloud/push`
```json
{
  "localPath": "sketches/main"
}
```

### 10.4 POST `/firmware/update`
```json
{
  "profileId": 12,
  "module": "NINA"
}
```

### 10.5 POST `/certificates/upload`
```json
{
  "profileId": 12,
  "certificatePem": "-----BEGIN CERTIFICATE-----..."
}
```

## 11. Error Codes (Draft)
1. `ARDUINO_CLI_NOT_FOUND`
2. `ARDUINO_CLI_EXEC_FAILED`
3. `ARDUINO_CLI_TIMEOUT`
4. `BOARD_NOT_DETECTED`
5. `PORT_BUSY`
6. `PROFILE_NOT_FOUND`
7. `SERIAL_SESSION_NOT_FOUND`
8. `INVALID_FQBN`
9. `INVALID_SKETCH_PATH`
10. `PATH_OUTSIDE_WORKSPACE`
11. `UNSUPPORTED_DEBUG_TARGET`
12. `PAYLOAD_TOO_LARGE`
13. `ARDUINO_FEATURE_DISABLED`

## 12. Failure-Mode Contract (Break-It Pass)
The following failure cases are required wire contracts for P1:

| ID | Endpoint | Trigger | Required Response |
| --- | --- | --- | --- |
| BRK-01 | `GET /health` | CLI binary missing | `503` + `ARDUINO_CLI_NOT_FOUND` |
| BRK-02 | `GET /health` | CLI version unsupported | `503` + `ARDUINO_CLI_EXEC_FAILED` with version details |
| BRK-03 | `PUT /workspace/files` | `path` escapes workspace root | `400` + `PATH_OUTSIDE_WORKSPACE` |
| BRK-04 | `PUT /workspace/files` | payload exceeds 1 MiB | `413` + `PAYLOAD_TOO_LARGE` |
| BRK-05 | `POST /jobs/compile` | invalid `sketchPath` | `400` + `INVALID_SKETCH_PATH` |
| BRK-06 | `POST /jobs/upload` | no usable board/port | `400` + `BOARD_NOT_DETECTED` |
| BRK-07 | `POST /jobs/upload` | upload already running on same `projectId+port` | `409` + `PORT_BUSY` |
| BRK-08 | `POST /jobs/:jobId/cancel` | job already terminal | `409` + stable error envelope, no state mutation |
| BRK-09 | `GET /serial/stream` | device disconnect during stream | SSE `error` event then terminal `status`, session closes cleanly |
| BRK-10 | `POST /serial/write` | unknown/closed session | `404` + `SERIAL_SESSION_NOT_FOUND` |
| BRK-11 | `POST /jobs/compile` or `/jobs/upload` | same `X-Idempotency-Key` replay within TTL | `202` with original `jobId`; no second process |
| BRK-12 | any Arduino route | feature flag disabled | `404` or `403` with `ARDUINO_FEATURE_DISABLED` (implementation choice must stay consistent) |

## 13. Contract Definition of Done + Test Matrix
Contract work is done only when:
1. Every endpoint in sections 3-9 has positive and negative test coverage.
2. Every BRK-01 through BRK-12 row is automated or documented as manual with reproducible steps.
3. SSE streams (`jobs/:jobId/logs`, `serial/stream`) emit deterministic terminal events and close behavior.
4. Error envelope shape is consistent on every non-2xx response.
5. Idempotency replay behavior is validated for compile and upload.

Required contract test matrix:

| Test ID | Layer | Contract Assertion |
| --- | --- | --- |
| CT-U01 | Unit | Error mapper always emits `{ message, code?, details? }`. |
| CT-U02 | Unit | Status enum transitions only allow `pending -> running -> completed/failed/cancelled`. |
| CT-I01 | Integration | `/health` returns `200` in healthy case and `503` + code in failed preflight case. |
| CT-I02 | Integration | `/workspace/files` rejects traversal and oversize payload with exact status/code pair. |
| CT-I03 | Integration | `/jobs/upload` enforces `PORT_BUSY` on contention. |
| CT-I04 | Integration | `/jobs/compile` and `/jobs/upload` idempotency returns same `jobId` on replay. |
| CT-I05 | Integration | `/serial/write` returns `404` + `SERIAL_SESSION_NOT_FOUND` for stale session. |
| CT-SSE01 | Integration | `/jobs/:jobId/logs` sends `log/status/done` and heartbeat behavior. |
| CT-SSE02 | Integration | `/serial/stream` sends `data/status/error` and closes cleanly on disconnect. |
| CT-E2E01 | E2E | Happy flow works with documented request/response shapes end-to-end. |
| CT-BRK01 | Break-It | BRK-01 through BRK-12 pass with evidence in PR. |

## 14. Backward Compatibility
1. Arduino APIs are additive and isolated under `/api/projects/:id/arduino`.
2. Existing non-Arduino routes are unchanged.
3. Feature flag can hide Arduino UI and block Arduino routes.
