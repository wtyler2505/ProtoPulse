# Arduino Workbench API Contracts (Draft)

**Status:** Draft  
**Date:** February 28, 2026  
**Scope:** Planning/specification only

## 1. Conventions
1. Base path: `/api/projects/:projectId/arduino`
2. Auth: existing `X-Session-Id` behavior in ProtoPulse.
3. Content type: `application/json` unless streaming endpoint.
4. Error shape:
```json
{
  "message": "Human readable error",
  "code": "ARDUINO_CLI_NOT_FOUND",
  "details": {}
}
```

## 2. Shared Types

## 2.1 BoardPort
```json
{
  "address": "/dev/ttyUSB0",
  "label": "USB Serial",
  "protocol": "serial",
  "boardName": "ESP32 Dev Module",
  "fqbn": "esp32:esp32:esp32"
}
```

## 2.2 BuildProfile
```json
{
  "id": 12,
  "name": "ESP32 Debug",
  "fqbn": "esp32:esp32:esp32",
  "port": "/dev/ttyUSB0",
  "boardOptions": {
    "FlashMode": "qio",
    "PartitionScheme": "default"
  },
  "libOverrides": {
    "ArduinoJson": "/opt/libs/ArduinoJson-7.0.3"
  },
  "verboseCompile": true,
  "verboseUpload": true,
  "isDefault": true
}
```

## 2.3 ArduinoJob
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
  "log": ""
}
```

## 3. Workspace Endpoints

### 3.1 GET `/workspace`
Returns workspace meta, file tree, active profile, and selected board/port.

Response `200`:
```json
{
  "workspace": {
    "rootPath": "projects/1/arduino",
    "activeSketchPath": "sketches/main/main.ino"
  },
  "files": [
    { "path": "sketches/main/main.ino", "language": "cpp", "size": 1520, "updatedAt": "2026-02-28T09:00:00.000Z" }
  ],
  "activeProfileId": 12
}
```

### 3.2 PUT `/workspace/files`
Create or update a file.

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

### 3.3 DELETE `/workspace/files`
Delete a file by path.

Request:
```json
{
  "path": "sketches/main/old.ino"
}
```

Response `204`: empty

### 3.4 POST `/workspace/format`
Run formatting on source content.

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

## 4. Board & Platform Endpoints

### 4.1 GET `/boards/discover`
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

### 4.2 GET `/boards/platforms`
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

### 4.3 POST `/boards/platforms/install`
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
  "status": "queued"
}
```

## 5. Library Endpoints

### 5.1 GET `/libraries?query=wifi&installed=true`
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

### 5.2 POST `/libraries/install`
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
  "jobId": 102,
  "status": "queued"
}
```

### 5.3 DELETE `/libraries/:name`
Response `204`: empty

## 6. Build Profile Endpoints

### 6.1 GET `/profiles`
Response `200`:
```json
{
  "profiles": [
    {
      "id": 12,
      "name": "ESP32 Debug",
      "fqbn": "esp32:esp32:esp32",
      "port": "/dev/ttyUSB0",
      "boardOptions": {},
      "libOverrides": {},
      "verboseCompile": true,
      "verboseUpload": true,
      "isDefault": true
    }
  ]
}
```

### 6.2 POST `/profiles`
Request:
```json
{
  "name": "UNO Release",
  "fqbn": "arduino:avr:uno",
  "port": "/dev/ttyACM0",
  "boardOptions": {},
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

### 6.3 PATCH `/profiles/:profileId`
Response `200`: updated profile

### 6.4 DELETE `/profiles/:profileId`
Response `204`: empty

## 7. Compile/Upload Job Endpoints

### 7.1 POST `/jobs/compile`
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
  "status": "queued"
}
```

### 7.2 POST `/jobs/upload`
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
  "status": "queued"
}
```

### 7.3 GET `/jobs/:jobId`
Response `200`: `ArduinoJob`

### 7.4 GET `/jobs/:jobId/logs` (SSE)
SSE events:
1. `log` -> line chunk
2. `status` -> lifecycle update
3. `done` -> final state

### 7.5 POST `/jobs/:jobId/cancel`
Response `200`:
```json
{
  "status": "canceled"
}
```

## 8. Serial Endpoints

### 8.1 POST `/serial/open`
Request:
```json
{
  "port": "/dev/ttyUSB0",
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

### 8.2 POST `/serial/write`
Request:
```json
{
  "sessionId": 40,
  "payload": "LED ON\\n"
}
```

Response `204`: empty

### 8.3 GET `/serial/stream?sessionId=40`
SSE stream of serial data packets.

### 8.4 POST `/serial/close`
Request:
```json
{
  "sessionId": 40
}
```

Response `204`: empty

## 9. Cloud/Firmware/Certificates (Phased)

### 9.1 GET `/cloud/status`
```json
{
  "connected": false,
  "provider": "arduino-cloud"
}
```

### 9.2 POST `/cloud/pull`
```json
{
  "remotePath": "my-sketches/device-a"
}
```

### 9.3 POST `/cloud/push`
```json
{
  "localPath": "sketches/main"
}
```

### 9.4 POST `/firmware/update`
```json
{
  "profileId": 12,
  "module": "NINA"
}
```

### 9.5 POST `/certificates/upload`
```json
{
  "profileId": 12,
  "certificatePem": "-----BEGIN CERTIFICATE-----..."
}
```

## 10. Error Codes (Draft)
1. `ARDUINO_CLI_NOT_FOUND`
2. `ARDUINO_CLI_EXEC_FAILED`
3. `BOARD_NOT_DETECTED`
4. `PORT_BUSY`
5. `PROFILE_NOT_FOUND`
6. `SERIAL_SESSION_NOT_FOUND`
7. `INVALID_FQBN`
8. `INVALID_SKETCH_PATH`
9. `UNSUPPORTED_DEBUG_TARGET`

## 11. Backward Compatibility
1. Arduino APIs are additive and isolated under the new namespace.
2. Existing project endpoints and data models are unchanged.
3. Feature flag can hide all Arduino UI and block route access if needed.
