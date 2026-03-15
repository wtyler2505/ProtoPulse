/**
 * ProtoPulse Error Taxonomy — stable error codes for the entire application.
 *
 * Error code format: PP-XYYY
 *   PP   = ProtoPulse prefix
 *   X    = domain digit (1-9)
 *   YYY  = sequential within domain (001-999)
 *
 * Domains:
 *   1xxx = Authentication & Authorization
 *   2xxx = Validation & Input
 *   3xxx = Export & Generation
 *   4xxx = Import & Parsing
 *   5xxx = Circuit & Simulation
 *   6xxx = AI & Agent
 *   7xxx = Storage & Database
 *   8xxx = Project & Collaboration
 *   9xxx = System & Infrastructure
 *
 * Usage:
 *   import { ErrorCode, ProtoPulseError, errorCatalog } from '@shared/error-taxonomy';
 *   throw new ProtoPulseError(ErrorCode.AUTH_SESSION_EXPIRED, { detail: 'Session timed out after 30m' });
 *
 * BL-0262
 */

// ---------------------------------------------------------------------------
// Error code enum — every code is a stable, documented identifier
// ---------------------------------------------------------------------------

export enum ErrorCode {
  // =========================================================================
  // 1xxx — Authentication & Authorization
  // =========================================================================

  /** No session header or credentials provided. */
  AUTH_REQUIRED = 'PP-1001',
  /** Session ID is syntactically invalid. */
  AUTH_SESSION_INVALID = 'PP-1002',
  /** Session has expired or been revoked. */
  AUTH_SESSION_EXPIRED = 'PP-1003',
  /** Valid session but insufficient permissions for this resource. */
  AUTH_FORBIDDEN = 'PP-1004',
  /** API key missing or malformed. */
  AUTH_API_KEY_MISSING = 'PP-1005',
  /** API key decryption or verification failed. */
  AUTH_API_KEY_INVALID = 'PP-1006',
  /** Admin operation attempted without admin credentials. */
  AUTH_ADMIN_REQUIRED = 'PP-1007',
  /** User does not own the target project. */
  AUTH_PROJECT_OWNERSHIP = 'PP-1008',
  /** Collaboration role insufficient (e.g. viewer trying to edit). */
  AUTH_ROLE_INSUFFICIENT = 'PP-1009',
  /** Login credentials (username/password) are wrong. */
  AUTH_CREDENTIALS_INVALID = 'PP-1010',
  /** Rate limit exceeded for auth-related operations. */
  AUTH_RATE_LIMITED = 'PP-1011',

  // =========================================================================
  // 2xxx — Validation & Input
  // =========================================================================

  /** Generic request body / query param validation failure. */
  VALIDATION_FAILED = 'PP-2001',
  /** A required field is missing from the request. */
  VALIDATION_FIELD_MISSING = 'PP-2002',
  /** A field value is out of its allowed range. */
  VALIDATION_FIELD_RANGE = 'PP-2003',
  /** A field value does not match the expected format. */
  VALIDATION_FIELD_FORMAT = 'PP-2004',
  /** An ID parameter is not a valid number. */
  VALIDATION_INVALID_ID = 'PP-2005',
  /** Pagination parameters (limit/offset) are invalid. */
  VALIDATION_PAGINATION = 'PP-2006',
  /** Request payload exceeds the size limit. */
  VALIDATION_PAYLOAD_TOO_LARGE = 'PP-2007',
  /** JSON body could not be parsed. */
  VALIDATION_JSON_PARSE = 'PP-2008',
  /** Zod schema validation produced errors. */
  VALIDATION_SCHEMA = 'PP-2009',
  /** DRC (Design Rule Check) violation detected. */
  VALIDATION_DRC_VIOLATION = 'PP-2010',
  /** ERC (Electrical Rule Check) violation detected. */
  VALIDATION_ERC_VIOLATION = 'PP-2011',
  /** DFM (Design for Manufacturing) check failed. */
  VALIDATION_DFM_FAILED = 'PP-2012',
  /** Net class rule constraint violated. */
  VALIDATION_NET_CLASS = 'PP-2013',
  /** Component placement constraint violated. */
  VALIDATION_PLACEMENT = 'PP-2014',
  /** Expression syntax error in design variable. */
  VALIDATION_EXPRESSION_SYNTAX = 'PP-2015',
  /** Circular dependency detected in design variables. */
  VALIDATION_CIRCULAR_DEPENDENCY = 'PP-2016',
  /** Division by zero in design variable expression. */
  VALIDATION_DIVISION_BY_ZERO = 'PP-2017',
  /** Undefined variable referenced in expression. */
  VALIDATION_UNDEFINED_VARIABLE = 'PP-2018',
  /** Invalid URL format or disallowed protocol. */
  VALIDATION_URL = 'PP-2019',
  /** SVG content failed sanitization. */
  VALIDATION_SVG_UNSAFE = 'PP-2020',

  // =========================================================================
  // 3xxx — Export & Generation
  // =========================================================================

  /** Generic export failure. */
  EXPORT_FAILED = 'PP-3001',
  /** KiCad format export error. */
  EXPORT_KICAD = 'PP-3002',
  /** Eagle format export error. */
  EXPORT_EAGLE = 'PP-3003',
  /** SPICE netlist export error. */
  EXPORT_SPICE = 'PP-3004',
  /** Gerber file generation error. */
  EXPORT_GERBER = 'PP-3005',
  /** Drill file generation error. */
  EXPORT_DRILL = 'PP-3006',
  /** Pick-and-place file generation error. */
  EXPORT_PICK_AND_PLACE = 'PP-3007',
  /** BOM export error. */
  EXPORT_BOM = 'PP-3008',
  /** PDF generation error. */
  EXPORT_PDF = 'PP-3009',
  /** ODB++ export error. */
  EXPORT_ODB_PLUS_PLUS = 'PP-3010',
  /** IPC-2581 export error. */
  EXPORT_IPC2581 = 'PP-3011',
  /** STEP 3D model export error. */
  EXPORT_STEP = 'PP-3012',
  /** Design report generation error. */
  EXPORT_DESIGN_REPORT = 'PP-3013',
  /** FMEA report generation error. */
  EXPORT_FMEA = 'PP-3014',
  /** Firmware scaffold generation error. */
  EXPORT_FIRMWARE_SCAFFOLD = 'PP-3015',
  /** Netlist generation error. */
  EXPORT_NETLIST = 'PP-3016',
  /** FZPZ component export error. */
  EXPORT_FZPZ = 'PP-3017',
  /** Etchable PCB export error. */
  EXPORT_ETCHABLE_PCB = 'PP-3018',
  /** LCSC/JLCPCB mapping export error. */
  EXPORT_LCSC_MAPPING = 'PP-3019',
  /** Export blocked by unresolved DRC violations. */
  EXPORT_DRC_GATE = 'PP-3020',

  // =========================================================================
  // 4xxx — Import & Parsing
  // =========================================================================

  /** Generic import failure. */
  IMPORT_FAILED = 'PP-4001',
  /** Unrecognized or unsupported file format. */
  IMPORT_FORMAT_UNKNOWN = 'PP-4002',
  /** KiCad file parse error. */
  IMPORT_KICAD = 'PP-4003',
  /** Eagle file parse error. */
  IMPORT_EAGLE = 'PP-4004',
  /** Altium file parse error. */
  IMPORT_ALTIUM = 'PP-4005',
  /** gEDA file parse error. */
  IMPORT_GEDA = 'PP-4006',
  /** LTspice file parse error. */
  IMPORT_LTSPICE = 'PP-4007',
  /** Proteus file parse error. */
  IMPORT_PROTEUS = 'PP-4008',
  /** OrCAD file parse error. */
  IMPORT_ORCAD = 'PP-4009',
  /** FZPZ component import error. */
  IMPORT_FZPZ = 'PP-4010',
  /** FZZ project import error. */
  IMPORT_FZZ = 'PP-4011',
  /** ZIP bomb detected during decompression. */
  IMPORT_ZIP_BOMB = 'PP-4012',
  /** SPICE netlist parse error. */
  IMPORT_SPICE_NETLIST = 'PP-4013',
  /** Decompressed file exceeds size limit. */
  IMPORT_SIZE_EXCEEDED = 'PP-4014',
  /** Too many files in archive. */
  IMPORT_FILE_COUNT_EXCEEDED = 'PP-4015',
  /** Backup/restore file is corrupt or invalid. */
  IMPORT_BACKUP_CORRUPT = 'PP-4016',

  // =========================================================================
  // 5xxx — Circuit & Simulation
  // =========================================================================

  /** Generic circuit operation error. */
  CIRCUIT_ERROR = 'PP-5001',
  /** Circuit design not found. */
  CIRCUIT_NOT_FOUND = 'PP-5002',
  /** Component instance not found in circuit. */
  CIRCUIT_INSTANCE_NOT_FOUND = 'PP-5003',
  /** Wire not found in circuit. */
  CIRCUIT_WIRE_NOT_FOUND = 'PP-5004',
  /** Net not found in circuit. */
  CIRCUIT_NET_NOT_FOUND = 'PP-5005',
  /** Autorouter failed to complete routing. */
  CIRCUIT_AUTOROUTE_FAILED = 'PP-5006',
  /** Push-and-shove routing could not resolve conflicts. */
  CIRCUIT_PUSH_SHOVE_FAILED = 'PP-5007',
  /** Differential pair routing constraint violated. */
  CIRCUIT_DIFF_PAIR_ERROR = 'PP-5008',
  /** Simulation failed to converge. */
  SIMULATION_CONVERGENCE = 'PP-5009',
  /** Simulation exceeded time or step limits. */
  SIMULATION_LIMIT_EXCEEDED = 'PP-5010',
  /** Invalid SPICE model parameters. */
  SIMULATION_MODEL_INVALID = 'PP-5011',
  /** Simulation matrix is singular (unsolvable circuit). */
  SIMULATION_SINGULAR_MATRIX = 'PP-5012',
  /** Monte Carlo analysis limit exceeded. */
  SIMULATION_MONTE_CARLO_LIMIT = 'PP-5013',
  /** Transient analysis timestep too small. */
  SIMULATION_TIMESTEP = 'PP-5014',
  /** WebGPU not available for acceleration. */
  SIMULATION_WEBGPU_UNAVAILABLE = 'PP-5015',
  /** Thermal analysis failed. */
  SIMULATION_THERMAL_FAILED = 'PP-5016',
  /** PDN impedance analysis error. */
  SIMULATION_PDN_ERROR = 'PP-5017',
  /** Signal integrity analysis error. */
  SIMULATION_SI_ERROR = 'PP-5018',
  /** Circuit DSL evaluation error. */
  CIRCUIT_DSL_EVAL_ERROR = 'PP-5019',
  /** Circuit DSL sandbox timeout (watchdog). */
  CIRCUIT_DSL_TIMEOUT = 'PP-5020',

  // =========================================================================
  // 6xxx — AI & Agent
  // =========================================================================

  /** AI provider returned an error. */
  AI_PROVIDER_ERROR = 'PP-6001',
  /** AI provider circuit breaker is open (temporarily unavailable). */
  AI_CIRCUIT_BREAKER_OPEN = 'PP-6002',
  /** AI response could not be parsed as valid JSON. */
  AI_RESPONSE_INVALID = 'PP-6003',
  /** AI action type is not recognized. */
  AI_ACTION_UNKNOWN = 'PP-6004',
  /** AI tool invocation failed. */
  AI_TOOL_FAILED = 'PP-6005',
  /** AI tool requires user confirmation before execution. */
  AI_TOOL_CONFIRMATION_REQUIRED = 'PP-6006',
  /** Agentic loop exceeded maximum steps. */
  AI_AGENT_MAX_STEPS = 'PP-6007',
  /** AI agent rate limit exceeded. */
  AI_AGENT_RATE_LIMITED = 'PP-6008',
  /** AI model not available or misconfigured. */
  AI_MODEL_UNAVAILABLE = 'PP-6009',
  /** AI confidence score below threshold. */
  AI_LOW_CONFIDENCE = 'PP-6010',
  /** Component image recognition failed. */
  AI_VISION_FAILED = 'PP-6011',
  /** Generative design optimization failed. */
  AI_GENERATIVE_FAILED = 'PP-6012',
  /** AI streaming connection interrupted. */
  AI_STREAM_INTERRUPTED = 'PP-6013',

  // =========================================================================
  // 7xxx — Storage & Database
  // =========================================================================

  /** Generic storage/database operation failed. */
  STORAGE_ERROR = 'PP-7001',
  /** Requested resource not found. */
  STORAGE_NOT_FOUND = 'PP-7002',
  /** Unique constraint violated (duplicate entry). */
  STORAGE_DUPLICATE = 'PP-7003',
  /** Foreign key constraint violated. */
  STORAGE_FK_VIOLATION = 'PP-7004',
  /** Not-null constraint violated. */
  STORAGE_NOT_NULL_VIOLATION = 'PP-7005',
  /** Check constraint violated. */
  STORAGE_CHECK_VIOLATION = 'PP-7006',
  /** Optimistic concurrency version conflict. */
  STORAGE_VERSION_CONFLICT = 'PP-7007',
  /** Query timed out. */
  STORAGE_QUERY_TIMEOUT = 'PP-7008',
  /** Database connection failed or lost. */
  STORAGE_CONNECTION_FAILED = 'PP-7009',
  /** Database server shutting down. */
  STORAGE_SERVER_SHUTDOWN = 'PP-7010',
  /** Transaction aborted. */
  STORAGE_TRANSACTION_ABORTED = 'PP-7011',
  /** Cache miss (informational, not necessarily an error). */
  STORAGE_CACHE_MISS = 'PP-7012',

  // =========================================================================
  // 8xxx — Project & Collaboration
  // =========================================================================

  /** Project not found. */
  PROJECT_NOT_FOUND = 'PP-8001',
  /** Project name is empty or invalid. */
  PROJECT_INVALID_NAME = 'PP-8002',
  /** Project has been soft-deleted. */
  PROJECT_DELETED = 'PP-8003',
  /** BOM item not found. */
  PROJECT_BOM_NOT_FOUND = 'PP-8004',
  /** Architecture node not found. */
  PROJECT_NODE_NOT_FOUND = 'PP-8005',
  /** Architecture edge not found. */
  PROJECT_EDGE_NOT_FOUND = 'PP-8006',
  /** Validation issue not found. */
  PROJECT_VALIDATION_NOT_FOUND = 'PP-8007',
  /** PCB order not found. */
  PROJECT_ORDER_NOT_FOUND = 'PP-8008',
  /** PCB order is in wrong status for requested operation. */
  PROJECT_ORDER_WRONG_STATUS = 'PP-8009',
  /** Collaboration room join failed. */
  COLLAB_JOIN_FAILED = 'PP-8010',
  /** Entity is locked by another collaborator. */
  COLLAB_ENTITY_LOCKED = 'PP-8011',
  /** WebSocket connection failed. */
  COLLAB_WS_ERROR = 'PP-8012',
  /** CRDT operation conflict. */
  COLLAB_CRDT_CONFLICT = 'PP-8013',
  /** Design snapshot not found. */
  PROJECT_SNAPSHOT_NOT_FOUND = 'PP-8014',
  /** Component lifecycle entry not found. */
  PROJECT_LIFECYCLE_NOT_FOUND = 'PP-8015',

  // =========================================================================
  // 9xxx — System & Infrastructure
  // =========================================================================

  /** Unclassified internal server error. */
  SYSTEM_INTERNAL = 'PP-9001',
  /** Service is unavailable (shutting down, overloaded, etc.). */
  SYSTEM_UNAVAILABLE = 'PP-9002',
  /** Rate limit exceeded (generic, non-auth). */
  SYSTEM_RATE_LIMITED = 'PP-9003',
  /** Job queue capacity exceeded. */
  SYSTEM_JOB_QUEUE_FULL = 'PP-9004',
  /** Background job failed. */
  SYSTEM_JOB_FAILED = 'PP-9005',
  /** Background job timed out. */
  SYSTEM_JOB_TIMEOUT = 'PP-9006',
  /** External service (supplier API, etc.) is unreachable. */
  SYSTEM_EXTERNAL_SERVICE = 'PP-9007',
  /** Web Serial port operation failed. */
  SYSTEM_SERIAL_ERROR = 'PP-9008',
  /** Web Serial port not found or disconnected. */
  SYSTEM_SERIAL_NOT_FOUND = 'PP-9009',
  /** Web Serial permission denied by browser. */
  SYSTEM_SERIAL_PERMISSION = 'PP-9010',
  /** IndexedDB operation failed (offline storage). */
  SYSTEM_INDEXEDDB_ERROR = 'PP-9011',
  /** Service worker registration or caching failed. */
  SYSTEM_SW_ERROR = 'PP-9012',
  /** API route not found (catch-all). */
  SYSTEM_API_NOT_FOUND = 'PP-9013',
  /** CSP violation report received. */
  SYSTEM_CSP_VIOLATION = 'PP-9014',
  /** Graceful shutdown in progress — rejecting new work. */
  SYSTEM_SHUTTING_DOWN = 'PP-9015',
}

// ---------------------------------------------------------------------------
// Error severity levels
// ---------------------------------------------------------------------------

export enum ErrorSeverity {
  /** Informational — operation succeeded with caveats. */
  INFO = 'info',
  /** Recoverable — client can retry or correct input. */
  WARNING = 'warning',
  /** Fatal — operation cannot proceed. */
  ERROR = 'error',
  /** Critical — system integrity may be at risk. */
  CRITICAL = 'critical',
}

// ---------------------------------------------------------------------------
// Error catalog entry — static metadata for each code
// ---------------------------------------------------------------------------

export interface ErrorCatalogEntry {
  /** Stable error code (e.g. PP-1001). */
  code: ErrorCode;
  /** Default HTTP status code to use in API responses. */
  httpStatus: number;
  /** Severity level. */
  severity: ErrorSeverity;
  /** Short human-readable label. */
  label: string;
  /** Longer description for docs / developer guidance. */
  description: string;
  /** Whether the client should retry (with backoff). */
  retryable: boolean;
}

// ---------------------------------------------------------------------------
// The catalog — single source of truth for all error metadata
// ---------------------------------------------------------------------------

export const errorCatalog: Record<ErrorCode, ErrorCatalogEntry> = {
  // --- 1xxx Auth ---
  [ErrorCode.AUTH_REQUIRED]: {
    code: ErrorCode.AUTH_REQUIRED,
    httpStatus: 401,
    severity: ErrorSeverity.ERROR,
    label: 'Authentication required',
    description: 'Request is missing the X-Session-Id header or other credentials.',
    retryable: false,
  },
  [ErrorCode.AUTH_SESSION_INVALID]: {
    code: ErrorCode.AUTH_SESSION_INVALID,
    httpStatus: 401,
    severity: ErrorSeverity.ERROR,
    label: 'Invalid session',
    description: 'The provided session ID is syntactically malformed.',
    retryable: false,
  },
  [ErrorCode.AUTH_SESSION_EXPIRED]: {
    code: ErrorCode.AUTH_SESSION_EXPIRED,
    httpStatus: 401,
    severity: ErrorSeverity.WARNING,
    label: 'Session expired',
    description: 'The session has expired or been revoked. Re-authenticate to continue.',
    retryable: false,
  },
  [ErrorCode.AUTH_FORBIDDEN]: {
    code: ErrorCode.AUTH_FORBIDDEN,
    httpStatus: 403,
    severity: ErrorSeverity.ERROR,
    label: 'Forbidden',
    description: 'Authenticated but insufficient permissions for this resource.',
    retryable: false,
  },
  [ErrorCode.AUTH_API_KEY_MISSING]: {
    code: ErrorCode.AUTH_API_KEY_MISSING,
    httpStatus: 401,
    severity: ErrorSeverity.ERROR,
    label: 'API key missing',
    description: 'An API key is required but was not provided.',
    retryable: false,
  },
  [ErrorCode.AUTH_API_KEY_INVALID]: {
    code: ErrorCode.AUTH_API_KEY_INVALID,
    httpStatus: 401,
    severity: ErrorSeverity.ERROR,
    label: 'API key invalid',
    description: 'The API key could not be decrypted or verified.',
    retryable: false,
  },
  [ErrorCode.AUTH_ADMIN_REQUIRED]: {
    code: ErrorCode.AUTH_ADMIN_REQUIRED,
    httpStatus: 403,
    severity: ErrorSeverity.ERROR,
    label: 'Admin access required',
    description: 'This operation requires administrator credentials.',
    retryable: false,
  },
  [ErrorCode.AUTH_PROJECT_OWNERSHIP]: {
    code: ErrorCode.AUTH_PROJECT_OWNERSHIP,
    httpStatus: 403,
    severity: ErrorSeverity.ERROR,
    label: 'Not project owner',
    description: 'You do not own this project and cannot perform this operation.',
    retryable: false,
  },
  [ErrorCode.AUTH_ROLE_INSUFFICIENT]: {
    code: ErrorCode.AUTH_ROLE_INSUFFICIENT,
    httpStatus: 403,
    severity: ErrorSeverity.ERROR,
    label: 'Insufficient collaboration role',
    description: 'Your collaboration role (e.g. viewer) does not allow this action.',
    retryable: false,
  },
  [ErrorCode.AUTH_CREDENTIALS_INVALID]: {
    code: ErrorCode.AUTH_CREDENTIALS_INVALID,
    httpStatus: 401,
    severity: ErrorSeverity.ERROR,
    label: 'Invalid credentials',
    description: 'Username or password is incorrect.',
    retryable: false,
  },
  [ErrorCode.AUTH_RATE_LIMITED]: {
    code: ErrorCode.AUTH_RATE_LIMITED,
    httpStatus: 429,
    severity: ErrorSeverity.WARNING,
    label: 'Auth rate limited',
    description: 'Too many authentication attempts. Wait before retrying.',
    retryable: true,
  },

  // --- 2xxx Validation ---
  [ErrorCode.VALIDATION_FAILED]: {
    code: ErrorCode.VALIDATION_FAILED,
    httpStatus: 400,
    severity: ErrorSeverity.ERROR,
    label: 'Validation failed',
    description: 'Request body or query parameters did not pass validation.',
    retryable: false,
  },
  [ErrorCode.VALIDATION_FIELD_MISSING]: {
    code: ErrorCode.VALIDATION_FIELD_MISSING,
    httpStatus: 400,
    severity: ErrorSeverity.ERROR,
    label: 'Required field missing',
    description: 'A required field was not included in the request.',
    retryable: false,
  },
  [ErrorCode.VALIDATION_FIELD_RANGE]: {
    code: ErrorCode.VALIDATION_FIELD_RANGE,
    httpStatus: 400,
    severity: ErrorSeverity.ERROR,
    label: 'Field out of range',
    description: 'A field value is outside its allowed minimum/maximum bounds.',
    retryable: false,
  },
  [ErrorCode.VALIDATION_FIELD_FORMAT]: {
    code: ErrorCode.VALIDATION_FIELD_FORMAT,
    httpStatus: 400,
    severity: ErrorSeverity.ERROR,
    label: 'Invalid field format',
    description: 'A field value does not match the expected format or pattern.',
    retryable: false,
  },
  [ErrorCode.VALIDATION_INVALID_ID]: {
    code: ErrorCode.VALIDATION_INVALID_ID,
    httpStatus: 400,
    severity: ErrorSeverity.ERROR,
    label: 'Invalid ID',
    description: 'An ID parameter is not a valid finite number.',
    retryable: false,
  },
  [ErrorCode.VALIDATION_PAGINATION]: {
    code: ErrorCode.VALIDATION_PAGINATION,
    httpStatus: 400,
    severity: ErrorSeverity.ERROR,
    label: 'Invalid pagination',
    description: 'Limit or offset parameters are out of allowed range.',
    retryable: false,
  },
  [ErrorCode.VALIDATION_PAYLOAD_TOO_LARGE]: {
    code: ErrorCode.VALIDATION_PAYLOAD_TOO_LARGE,
    httpStatus: 413,
    severity: ErrorSeverity.ERROR,
    label: 'Payload too large',
    description: 'The request body exceeds the maximum allowed size.',
    retryable: false,
  },
  [ErrorCode.VALIDATION_JSON_PARSE]: {
    code: ErrorCode.VALIDATION_JSON_PARSE,
    httpStatus: 400,
    severity: ErrorSeverity.ERROR,
    label: 'Malformed JSON',
    description: 'The request body is not valid JSON.',
    retryable: false,
  },
  [ErrorCode.VALIDATION_SCHEMA]: {
    code: ErrorCode.VALIDATION_SCHEMA,
    httpStatus: 400,
    severity: ErrorSeverity.ERROR,
    label: 'Schema validation error',
    description: 'Zod schema validation failed. See details for specific field errors.',
    retryable: false,
  },
  [ErrorCode.VALIDATION_DRC_VIOLATION]: {
    code: ErrorCode.VALIDATION_DRC_VIOLATION,
    httpStatus: 422,
    severity: ErrorSeverity.WARNING,
    label: 'DRC violation',
    description: 'Design Rule Check detected violations in the design.',
    retryable: false,
  },
  [ErrorCode.VALIDATION_ERC_VIOLATION]: {
    code: ErrorCode.VALIDATION_ERC_VIOLATION,
    httpStatus: 422,
    severity: ErrorSeverity.WARNING,
    label: 'ERC violation',
    description: 'Electrical Rule Check detected violations in the circuit.',
    retryable: false,
  },
  [ErrorCode.VALIDATION_DFM_FAILED]: {
    code: ErrorCode.VALIDATION_DFM_FAILED,
    httpStatus: 422,
    severity: ErrorSeverity.WARNING,
    label: 'DFM check failed',
    description: 'Design for Manufacturing check found manufacturability issues.',
    retryable: false,
  },
  [ErrorCode.VALIDATION_NET_CLASS]: {
    code: ErrorCode.VALIDATION_NET_CLASS,
    httpStatus: 422,
    severity: ErrorSeverity.WARNING,
    label: 'Net class constraint violated',
    description: 'A net class rule (trace width, clearance, etc.) was violated.',
    retryable: false,
  },
  [ErrorCode.VALIDATION_PLACEMENT]: {
    code: ErrorCode.VALIDATION_PLACEMENT,
    httpStatus: 422,
    severity: ErrorSeverity.WARNING,
    label: 'Placement constraint violated',
    description: 'Component placement overlaps or violates courtyard/keepout rules.',
    retryable: false,
  },
  [ErrorCode.VALIDATION_EXPRESSION_SYNTAX]: {
    code: ErrorCode.VALIDATION_EXPRESSION_SYNTAX,
    httpStatus: 400,
    severity: ErrorSeverity.ERROR,
    label: 'Expression syntax error',
    description: 'A design variable expression has invalid syntax.',
    retryable: false,
  },
  [ErrorCode.VALIDATION_CIRCULAR_DEPENDENCY]: {
    code: ErrorCode.VALIDATION_CIRCULAR_DEPENDENCY,
    httpStatus: 400,
    severity: ErrorSeverity.ERROR,
    label: 'Circular dependency',
    description: 'Design variables form a circular dependency cycle.',
    retryable: false,
  },
  [ErrorCode.VALIDATION_DIVISION_BY_ZERO]: {
    code: ErrorCode.VALIDATION_DIVISION_BY_ZERO,
    httpStatus: 400,
    severity: ErrorSeverity.ERROR,
    label: 'Division by zero',
    description: 'A design variable expression attempted division by zero.',
    retryable: false,
  },
  [ErrorCode.VALIDATION_UNDEFINED_VARIABLE]: {
    code: ErrorCode.VALIDATION_UNDEFINED_VARIABLE,
    httpStatus: 400,
    severity: ErrorSeverity.ERROR,
    label: 'Undefined variable',
    description: 'An expression references a variable that has not been defined.',
    retryable: false,
  },
  [ErrorCode.VALIDATION_URL]: {
    code: ErrorCode.VALIDATION_URL,
    httpStatus: 400,
    severity: ErrorSeverity.ERROR,
    label: 'Invalid URL',
    description: 'The URL is malformed or uses a disallowed protocol.',
    retryable: false,
  },
  [ErrorCode.VALIDATION_SVG_UNSAFE]: {
    code: ErrorCode.VALIDATION_SVG_UNSAFE,
    httpStatus: 400,
    severity: ErrorSeverity.ERROR,
    label: 'Unsafe SVG content',
    description: 'SVG content contains script, event handlers, or other unsafe elements.',
    retryable: false,
  },

  // --- 3xxx Export ---
  [ErrorCode.EXPORT_FAILED]: {
    code: ErrorCode.EXPORT_FAILED,
    httpStatus: 500,
    severity: ErrorSeverity.ERROR,
    label: 'Export failed',
    description: 'A generic export operation failed. See details for the specific cause.',
    retryable: true,
  },
  [ErrorCode.EXPORT_KICAD]: {
    code: ErrorCode.EXPORT_KICAD,
    httpStatus: 500,
    severity: ErrorSeverity.ERROR,
    label: 'KiCad export error',
    description: 'Failed to generate KiCad format output.',
    retryable: true,
  },
  [ErrorCode.EXPORT_EAGLE]: {
    code: ErrorCode.EXPORT_EAGLE,
    httpStatus: 500,
    severity: ErrorSeverity.ERROR,
    label: 'Eagle export error',
    description: 'Failed to generate Eagle format output.',
    retryable: true,
  },
  [ErrorCode.EXPORT_SPICE]: {
    code: ErrorCode.EXPORT_SPICE,
    httpStatus: 500,
    severity: ErrorSeverity.ERROR,
    label: 'SPICE export error',
    description: 'Failed to generate SPICE netlist output.',
    retryable: true,
  },
  [ErrorCode.EXPORT_GERBER]: {
    code: ErrorCode.EXPORT_GERBER,
    httpStatus: 500,
    severity: ErrorSeverity.ERROR,
    label: 'Gerber export error',
    description: 'Failed to generate Gerber photoplotter files.',
    retryable: true,
  },
  [ErrorCode.EXPORT_DRILL]: {
    code: ErrorCode.EXPORT_DRILL,
    httpStatus: 500,
    severity: ErrorSeverity.ERROR,
    label: 'Drill file error',
    description: 'Failed to generate Excellon drill files.',
    retryable: true,
  },
  [ErrorCode.EXPORT_PICK_AND_PLACE]: {
    code: ErrorCode.EXPORT_PICK_AND_PLACE,
    httpStatus: 500,
    severity: ErrorSeverity.ERROR,
    label: 'Pick-and-place export error',
    description: 'Failed to generate pick-and-place/centroid files.',
    retryable: true,
  },
  [ErrorCode.EXPORT_BOM]: {
    code: ErrorCode.EXPORT_BOM,
    httpStatus: 500,
    severity: ErrorSeverity.ERROR,
    label: 'BOM export error',
    description: 'Failed to generate Bill of Materials output.',
    retryable: true,
  },
  [ErrorCode.EXPORT_PDF]: {
    code: ErrorCode.EXPORT_PDF,
    httpStatus: 500,
    severity: ErrorSeverity.ERROR,
    label: 'PDF export error',
    description: 'Failed to generate PDF document.',
    retryable: true,
  },
  [ErrorCode.EXPORT_ODB_PLUS_PLUS]: {
    code: ErrorCode.EXPORT_ODB_PLUS_PLUS,
    httpStatus: 500,
    severity: ErrorSeverity.ERROR,
    label: 'ODB++ export error',
    description: 'Failed to generate ODB++ manufacturing output.',
    retryable: true,
  },
  [ErrorCode.EXPORT_IPC2581]: {
    code: ErrorCode.EXPORT_IPC2581,
    httpStatus: 500,
    severity: ErrorSeverity.ERROR,
    label: 'IPC-2581 export error',
    description: 'Failed to generate IPC-2581 XML output.',
    retryable: true,
  },
  [ErrorCode.EXPORT_STEP]: {
    code: ErrorCode.EXPORT_STEP,
    httpStatus: 500,
    severity: ErrorSeverity.ERROR,
    label: 'STEP export error',
    description: 'Failed to generate STEP 3D model output.',
    retryable: true,
  },
  [ErrorCode.EXPORT_DESIGN_REPORT]: {
    code: ErrorCode.EXPORT_DESIGN_REPORT,
    httpStatus: 500,
    severity: ErrorSeverity.ERROR,
    label: 'Design report error',
    description: 'Failed to generate design report.',
    retryable: true,
  },
  [ErrorCode.EXPORT_FMEA]: {
    code: ErrorCode.EXPORT_FMEA,
    httpStatus: 500,
    severity: ErrorSeverity.ERROR,
    label: 'FMEA report error',
    description: 'Failed to generate Failure Mode and Effects Analysis report.',
    retryable: true,
  },
  [ErrorCode.EXPORT_FIRMWARE_SCAFFOLD]: {
    code: ErrorCode.EXPORT_FIRMWARE_SCAFFOLD,
    httpStatus: 500,
    severity: ErrorSeverity.ERROR,
    label: 'Firmware scaffold error',
    description: 'Failed to generate firmware scaffold/template code.',
    retryable: true,
  },
  [ErrorCode.EXPORT_NETLIST]: {
    code: ErrorCode.EXPORT_NETLIST,
    httpStatus: 500,
    severity: ErrorSeverity.ERROR,
    label: 'Netlist export error',
    description: 'Failed to generate netlist output.',
    retryable: true,
  },
  [ErrorCode.EXPORT_FZPZ]: {
    code: ErrorCode.EXPORT_FZPZ,
    httpStatus: 500,
    severity: ErrorSeverity.ERROR,
    label: 'FZPZ export error',
    description: 'Failed to generate Fritzing component package.',
    retryable: true,
  },
  [ErrorCode.EXPORT_ETCHABLE_PCB]: {
    code: ErrorCode.EXPORT_ETCHABLE_PCB,
    httpStatus: 500,
    severity: ErrorSeverity.ERROR,
    label: 'Etchable PCB export error',
    description: 'Failed to generate home-etchable PCB artwork.',
    retryable: true,
  },
  [ErrorCode.EXPORT_LCSC_MAPPING]: {
    code: ErrorCode.EXPORT_LCSC_MAPPING,
    httpStatus: 500,
    severity: ErrorSeverity.ERROR,
    label: 'LCSC mapping export error',
    description: 'Failed to generate LCSC/JLCPCB component mapping CSV.',
    retryable: true,
  },
  [ErrorCode.EXPORT_DRC_GATE]: {
    code: ErrorCode.EXPORT_DRC_GATE,
    httpStatus: 422,
    severity: ErrorSeverity.WARNING,
    label: 'Export blocked by DRC',
    description: 'Export is blocked because the design has unresolved DRC violations.',
    retryable: false,
  },

  // --- 4xxx Import ---
  [ErrorCode.IMPORT_FAILED]: {
    code: ErrorCode.IMPORT_FAILED,
    httpStatus: 400,
    severity: ErrorSeverity.ERROR,
    label: 'Import failed',
    description: 'A generic import operation failed.',
    retryable: false,
  },
  [ErrorCode.IMPORT_FORMAT_UNKNOWN]: {
    code: ErrorCode.IMPORT_FORMAT_UNKNOWN,
    httpStatus: 400,
    severity: ErrorSeverity.ERROR,
    label: 'Unknown import format',
    description: 'The file format could not be detected or is not supported.',
    retryable: false,
  },
  [ErrorCode.IMPORT_KICAD]: {
    code: ErrorCode.IMPORT_KICAD,
    httpStatus: 400,
    severity: ErrorSeverity.ERROR,
    label: 'KiCad import error',
    description: 'Failed to parse KiCad format file.',
    retryable: false,
  },
  [ErrorCode.IMPORT_EAGLE]: {
    code: ErrorCode.IMPORT_EAGLE,
    httpStatus: 400,
    severity: ErrorSeverity.ERROR,
    label: 'Eagle import error',
    description: 'Failed to parse Eagle XML file.',
    retryable: false,
  },
  [ErrorCode.IMPORT_ALTIUM]: {
    code: ErrorCode.IMPORT_ALTIUM,
    httpStatus: 400,
    severity: ErrorSeverity.ERROR,
    label: 'Altium import error',
    description: 'Failed to parse Altium Designer file.',
    retryable: false,
  },
  [ErrorCode.IMPORT_GEDA]: {
    code: ErrorCode.IMPORT_GEDA,
    httpStatus: 400,
    severity: ErrorSeverity.ERROR,
    label: 'gEDA import error',
    description: 'Failed to parse gEDA/gschem file.',
    retryable: false,
  },
  [ErrorCode.IMPORT_LTSPICE]: {
    code: ErrorCode.IMPORT_LTSPICE,
    httpStatus: 400,
    severity: ErrorSeverity.ERROR,
    label: 'LTspice import error',
    description: 'Failed to parse LTspice schematic file.',
    retryable: false,
  },
  [ErrorCode.IMPORT_PROTEUS]: {
    code: ErrorCode.IMPORT_PROTEUS,
    httpStatus: 400,
    severity: ErrorSeverity.ERROR,
    label: 'Proteus import error',
    description: 'Failed to parse Proteus Design Suite file.',
    retryable: false,
  },
  [ErrorCode.IMPORT_ORCAD]: {
    code: ErrorCode.IMPORT_ORCAD,
    httpStatus: 400,
    severity: ErrorSeverity.ERROR,
    label: 'OrCAD import error',
    description: 'Failed to parse OrCAD file.',
    retryable: false,
  },
  [ErrorCode.IMPORT_FZPZ]: {
    code: ErrorCode.IMPORT_FZPZ,
    httpStatus: 400,
    severity: ErrorSeverity.ERROR,
    label: 'FZPZ import error',
    description: 'Failed to parse Fritzing component package.',
    retryable: false,
  },
  [ErrorCode.IMPORT_FZZ]: {
    code: ErrorCode.IMPORT_FZZ,
    httpStatus: 400,
    severity: ErrorSeverity.ERROR,
    label: 'FZZ import error',
    description: 'Failed to parse Fritzing project archive.',
    retryable: false,
  },
  [ErrorCode.IMPORT_ZIP_BOMB]: {
    code: ErrorCode.IMPORT_ZIP_BOMB,
    httpStatus: 400,
    severity: ErrorSeverity.CRITICAL,
    label: 'ZIP bomb detected',
    description: 'Archive decompression ratio indicates a potential ZIP bomb attack.',
    retryable: false,
  },
  [ErrorCode.IMPORT_SPICE_NETLIST]: {
    code: ErrorCode.IMPORT_SPICE_NETLIST,
    httpStatus: 400,
    severity: ErrorSeverity.ERROR,
    label: 'SPICE netlist parse error',
    description: 'Failed to parse SPICE netlist text.',
    retryable: false,
  },
  [ErrorCode.IMPORT_SIZE_EXCEEDED]: {
    code: ErrorCode.IMPORT_SIZE_EXCEEDED,
    httpStatus: 400,
    severity: ErrorSeverity.ERROR,
    label: 'Import size exceeded',
    description: 'Decompressed content exceeds the maximum allowed size.',
    retryable: false,
  },
  [ErrorCode.IMPORT_FILE_COUNT_EXCEEDED]: {
    code: ErrorCode.IMPORT_FILE_COUNT_EXCEEDED,
    httpStatus: 400,
    severity: ErrorSeverity.ERROR,
    label: 'Too many files in archive',
    description: 'The archive contains more files than the allowed maximum.',
    retryable: false,
  },
  [ErrorCode.IMPORT_BACKUP_CORRUPT]: {
    code: ErrorCode.IMPORT_BACKUP_CORRUPT,
    httpStatus: 400,
    severity: ErrorSeverity.ERROR,
    label: 'Backup file corrupt',
    description: 'The backup/restore file is corrupt, incomplete, or invalid.',
    retryable: false,
  },

  // --- 5xxx Circuit & Simulation ---
  [ErrorCode.CIRCUIT_ERROR]: {
    code: ErrorCode.CIRCUIT_ERROR,
    httpStatus: 500,
    severity: ErrorSeverity.ERROR,
    label: 'Circuit error',
    description: 'A generic circuit operation failed.',
    retryable: true,
  },
  [ErrorCode.CIRCUIT_NOT_FOUND]: {
    code: ErrorCode.CIRCUIT_NOT_FOUND,
    httpStatus: 404,
    severity: ErrorSeverity.ERROR,
    label: 'Circuit design not found',
    description: 'The specified circuit design does not exist.',
    retryable: false,
  },
  [ErrorCode.CIRCUIT_INSTANCE_NOT_FOUND]: {
    code: ErrorCode.CIRCUIT_INSTANCE_NOT_FOUND,
    httpStatus: 404,
    severity: ErrorSeverity.ERROR,
    label: 'Component instance not found',
    description: 'The specified component instance does not exist in the circuit.',
    retryable: false,
  },
  [ErrorCode.CIRCUIT_WIRE_NOT_FOUND]: {
    code: ErrorCode.CIRCUIT_WIRE_NOT_FOUND,
    httpStatus: 404,
    severity: ErrorSeverity.ERROR,
    label: 'Wire not found',
    description: 'The specified wire does not exist in the circuit.',
    retryable: false,
  },
  [ErrorCode.CIRCUIT_NET_NOT_FOUND]: {
    code: ErrorCode.CIRCUIT_NET_NOT_FOUND,
    httpStatus: 404,
    severity: ErrorSeverity.ERROR,
    label: 'Net not found',
    description: 'The specified net does not exist in the circuit.',
    retryable: false,
  },
  [ErrorCode.CIRCUIT_AUTOROUTE_FAILED]: {
    code: ErrorCode.CIRCUIT_AUTOROUTE_FAILED,
    httpStatus: 422,
    severity: ErrorSeverity.WARNING,
    label: 'Autoroute failed',
    description: 'The autorouter could not complete routing for all nets.',
    retryable: true,
  },
  [ErrorCode.CIRCUIT_PUSH_SHOVE_FAILED]: {
    code: ErrorCode.CIRCUIT_PUSH_SHOVE_FAILED,
    httpStatus: 422,
    severity: ErrorSeverity.WARNING,
    label: 'Push-and-shove failed',
    description: 'Push-and-shove routing could not resolve trace conflicts.',
    retryable: true,
  },
  [ErrorCode.CIRCUIT_DIFF_PAIR_ERROR]: {
    code: ErrorCode.CIRCUIT_DIFF_PAIR_ERROR,
    httpStatus: 422,
    severity: ErrorSeverity.WARNING,
    label: 'Differential pair error',
    description: 'Differential pair routing constraint was violated.',
    retryable: false,
  },
  [ErrorCode.SIMULATION_CONVERGENCE]: {
    code: ErrorCode.SIMULATION_CONVERGENCE,
    httpStatus: 422,
    severity: ErrorSeverity.WARNING,
    label: 'Simulation did not converge',
    description: 'Newton-Raphson iteration did not converge within the maximum step count.',
    retryable: true,
  },
  [ErrorCode.SIMULATION_LIMIT_EXCEEDED]: {
    code: ErrorCode.SIMULATION_LIMIT_EXCEEDED,
    httpStatus: 422,
    severity: ErrorSeverity.ERROR,
    label: 'Simulation limit exceeded',
    description: 'The simulation exceeded maximum allowed nodes, steps, or duration.',
    retryable: false,
  },
  [ErrorCode.SIMULATION_MODEL_INVALID]: {
    code: ErrorCode.SIMULATION_MODEL_INVALID,
    httpStatus: 400,
    severity: ErrorSeverity.ERROR,
    label: 'Invalid SPICE model',
    description: 'SPICE model parameters are missing or invalid.',
    retryable: false,
  },
  [ErrorCode.SIMULATION_SINGULAR_MATRIX]: {
    code: ErrorCode.SIMULATION_SINGULAR_MATRIX,
    httpStatus: 422,
    severity: ErrorSeverity.ERROR,
    label: 'Singular matrix',
    description: 'The circuit matrix is singular (circuit may have floating nodes or short circuits).',
    retryable: false,
  },
  [ErrorCode.SIMULATION_MONTE_CARLO_LIMIT]: {
    code: ErrorCode.SIMULATION_MONTE_CARLO_LIMIT,
    httpStatus: 422,
    severity: ErrorSeverity.ERROR,
    label: 'Monte Carlo limit exceeded',
    description: 'Monte Carlo analysis exceeded the maximum iteration or sample count.',
    retryable: false,
  },
  [ErrorCode.SIMULATION_TIMESTEP]: {
    code: ErrorCode.SIMULATION_TIMESTEP,
    httpStatus: 422,
    severity: ErrorSeverity.WARNING,
    label: 'Timestep too small',
    description: 'Transient analysis adaptive timestep became smaller than minimum.',
    retryable: true,
  },
  [ErrorCode.SIMULATION_WEBGPU_UNAVAILABLE]: {
    code: ErrorCode.SIMULATION_WEBGPU_UNAVAILABLE,
    httpStatus: 200,
    severity: ErrorSeverity.INFO,
    label: 'WebGPU unavailable',
    description: 'WebGPU is not available; falling back to CPU computation.',
    retryable: false,
  },
  [ErrorCode.SIMULATION_THERMAL_FAILED]: {
    code: ErrorCode.SIMULATION_THERMAL_FAILED,
    httpStatus: 422,
    severity: ErrorSeverity.ERROR,
    label: 'Thermal analysis failed',
    description: 'Thermal resistance network solver failed to converge.',
    retryable: true,
  },
  [ErrorCode.SIMULATION_PDN_ERROR]: {
    code: ErrorCode.SIMULATION_PDN_ERROR,
    httpStatus: 422,
    severity: ErrorSeverity.ERROR,
    label: 'PDN analysis error',
    description: 'Power delivery network impedance analysis encountered an error.',
    retryable: true,
  },
  [ErrorCode.SIMULATION_SI_ERROR]: {
    code: ErrorCode.SIMULATION_SI_ERROR,
    httpStatus: 422,
    severity: ErrorSeverity.ERROR,
    label: 'Signal integrity error',
    description: 'Signal integrity analysis (crosstalk, eye diagram, etc.) failed.',
    retryable: true,
  },
  [ErrorCode.CIRCUIT_DSL_EVAL_ERROR]: {
    code: ErrorCode.CIRCUIT_DSL_EVAL_ERROR,
    httpStatus: 400,
    severity: ErrorSeverity.ERROR,
    label: 'Circuit DSL evaluation error',
    description: 'Circuit-as-code DSL script failed to evaluate.',
    retryable: false,
  },
  [ErrorCode.CIRCUIT_DSL_TIMEOUT]: {
    code: ErrorCode.CIRCUIT_DSL_TIMEOUT,
    httpStatus: 408,
    severity: ErrorSeverity.ERROR,
    label: 'Circuit DSL timeout',
    description: 'Circuit DSL sandbox watchdog terminated execution (exceeded time limit).',
    retryable: false,
  },

  // --- 6xxx AI ---
  [ErrorCode.AI_PROVIDER_ERROR]: {
    code: ErrorCode.AI_PROVIDER_ERROR,
    httpStatus: 502,
    severity: ErrorSeverity.ERROR,
    label: 'AI provider error',
    description: 'The upstream AI provider (Anthropic/Google) returned an error.',
    retryable: true,
  },
  [ErrorCode.AI_CIRCUIT_BREAKER_OPEN]: {
    code: ErrorCode.AI_CIRCUIT_BREAKER_OPEN,
    httpStatus: 503,
    severity: ErrorSeverity.WARNING,
    label: 'AI temporarily unavailable',
    description: 'Circuit breaker is open due to repeated provider failures. Will retry after cooldown.',
    retryable: true,
  },
  [ErrorCode.AI_RESPONSE_INVALID]: {
    code: ErrorCode.AI_RESPONSE_INVALID,
    httpStatus: 422,
    severity: ErrorSeverity.ERROR,
    label: 'Invalid AI response',
    description: 'The AI model returned a response that could not be parsed as valid JSON.',
    retryable: true,
  },
  [ErrorCode.AI_ACTION_UNKNOWN]: {
    code: ErrorCode.AI_ACTION_UNKNOWN,
    httpStatus: 400,
    severity: ErrorSeverity.WARNING,
    label: 'Unknown AI action',
    description: 'The AI action type is not recognized by the action parser.',
    retryable: false,
  },
  [ErrorCode.AI_TOOL_FAILED]: {
    code: ErrorCode.AI_TOOL_FAILED,
    httpStatus: 500,
    severity: ErrorSeverity.ERROR,
    label: 'AI tool execution failed',
    description: 'An AI tool invocation failed during execution.',
    retryable: true,
  },
  [ErrorCode.AI_TOOL_CONFIRMATION_REQUIRED]: {
    code: ErrorCode.AI_TOOL_CONFIRMATION_REQUIRED,
    httpStatus: 200,
    severity: ErrorSeverity.INFO,
    label: 'Tool confirmation required',
    description: 'The AI tool requires explicit user confirmation before execution.',
    retryable: false,
  },
  [ErrorCode.AI_AGENT_MAX_STEPS]: {
    code: ErrorCode.AI_AGENT_MAX_STEPS,
    httpStatus: 200,
    severity: ErrorSeverity.WARNING,
    label: 'Agent max steps reached',
    description: 'The agentic AI loop reached the maximum allowed step count.',
    retryable: false,
  },
  [ErrorCode.AI_AGENT_RATE_LIMITED]: {
    code: ErrorCode.AI_AGENT_RATE_LIMITED,
    httpStatus: 429,
    severity: ErrorSeverity.WARNING,
    label: 'Agent rate limited',
    description: 'Design agent requests exceeded the per-minute rate limit.',
    retryable: true,
  },
  [ErrorCode.AI_MODEL_UNAVAILABLE]: {
    code: ErrorCode.AI_MODEL_UNAVAILABLE,
    httpStatus: 503,
    severity: ErrorSeverity.ERROR,
    label: 'AI model unavailable',
    description: 'The requested AI model is not available or is misconfigured.',
    retryable: true,
  },
  [ErrorCode.AI_LOW_CONFIDENCE]: {
    code: ErrorCode.AI_LOW_CONFIDENCE,
    httpStatus: 200,
    severity: ErrorSeverity.INFO,
    label: 'Low AI confidence',
    description: 'The AI confidence score is below the auto-apply threshold.',
    retryable: false,
  },
  [ErrorCode.AI_VISION_FAILED]: {
    code: ErrorCode.AI_VISION_FAILED,
    httpStatus: 422,
    severity: ErrorSeverity.ERROR,
    label: 'Vision recognition failed',
    description: 'Component image recognition could not identify the part.',
    retryable: true,
  },
  [ErrorCode.AI_GENERATIVE_FAILED]: {
    code: ErrorCode.AI_GENERATIVE_FAILED,
    httpStatus: 422,
    severity: ErrorSeverity.ERROR,
    label: 'Generative design failed',
    description: 'Generative design optimization failed to produce viable candidates.',
    retryable: true,
  },
  [ErrorCode.AI_STREAM_INTERRUPTED]: {
    code: ErrorCode.AI_STREAM_INTERRUPTED,
    httpStatus: 502,
    severity: ErrorSeverity.WARNING,
    label: 'AI stream interrupted',
    description: 'The SSE streaming connection to the AI provider was interrupted.',
    retryable: true,
  },

  // --- 7xxx Storage ---
  [ErrorCode.STORAGE_ERROR]: {
    code: ErrorCode.STORAGE_ERROR,
    httpStatus: 500,
    severity: ErrorSeverity.ERROR,
    label: 'Storage error',
    description: 'An unclassified storage/database operation failed.',
    retryable: true,
  },
  [ErrorCode.STORAGE_NOT_FOUND]: {
    code: ErrorCode.STORAGE_NOT_FOUND,
    httpStatus: 404,
    severity: ErrorSeverity.ERROR,
    label: 'Resource not found',
    description: 'The requested database resource does not exist.',
    retryable: false,
  },
  [ErrorCode.STORAGE_DUPLICATE]: {
    code: ErrorCode.STORAGE_DUPLICATE,
    httpStatus: 409,
    severity: ErrorSeverity.ERROR,
    label: 'Duplicate entry',
    description: 'A unique constraint was violated (duplicate key).',
    retryable: false,
  },
  [ErrorCode.STORAGE_FK_VIOLATION]: {
    code: ErrorCode.STORAGE_FK_VIOLATION,
    httpStatus: 400,
    severity: ErrorSeverity.ERROR,
    label: 'Foreign key violation',
    description: 'A foreign key constraint was violated (referenced entity does not exist).',
    retryable: false,
  },
  [ErrorCode.STORAGE_NOT_NULL_VIOLATION]: {
    code: ErrorCode.STORAGE_NOT_NULL_VIOLATION,
    httpStatus: 400,
    severity: ErrorSeverity.ERROR,
    label: 'Not-null violation',
    description: 'A required (non-nullable) column received a null value.',
    retryable: false,
  },
  [ErrorCode.STORAGE_CHECK_VIOLATION]: {
    code: ErrorCode.STORAGE_CHECK_VIOLATION,
    httpStatus: 400,
    severity: ErrorSeverity.ERROR,
    label: 'Check constraint violation',
    description: 'A database CHECK constraint was violated.',
    retryable: false,
  },
  [ErrorCode.STORAGE_VERSION_CONFLICT]: {
    code: ErrorCode.STORAGE_VERSION_CONFLICT,
    httpStatus: 409,
    severity: ErrorSeverity.WARNING,
    label: 'Version conflict',
    description: 'Optimistic concurrency check failed — the resource was modified by another request.',
    retryable: true,
  },
  [ErrorCode.STORAGE_QUERY_TIMEOUT]: {
    code: ErrorCode.STORAGE_QUERY_TIMEOUT,
    httpStatus: 408,
    severity: ErrorSeverity.ERROR,
    label: 'Query timeout',
    description: 'A database query exceeded the timeout limit.',
    retryable: true,
  },
  [ErrorCode.STORAGE_CONNECTION_FAILED]: {
    code: ErrorCode.STORAGE_CONNECTION_FAILED,
    httpStatus: 503,
    severity: ErrorSeverity.CRITICAL,
    label: 'Database connection failed',
    description: 'Could not establish or maintain a connection to the database.',
    retryable: true,
  },
  [ErrorCode.STORAGE_SERVER_SHUTDOWN]: {
    code: ErrorCode.STORAGE_SERVER_SHUTDOWN,
    httpStatus: 503,
    severity: ErrorSeverity.CRITICAL,
    label: 'Database server shutdown',
    description: 'The database server is shutting down.',
    retryable: true,
  },
  [ErrorCode.STORAGE_TRANSACTION_ABORTED]: {
    code: ErrorCode.STORAGE_TRANSACTION_ABORTED,
    httpStatus: 500,
    severity: ErrorSeverity.ERROR,
    label: 'Transaction aborted',
    description: 'A database transaction was rolled back.',
    retryable: true,
  },
  [ErrorCode.STORAGE_CACHE_MISS]: {
    code: ErrorCode.STORAGE_CACHE_MISS,
    httpStatus: 200,
    severity: ErrorSeverity.INFO,
    label: 'Cache miss',
    description: 'Requested data was not in the LRU cache (informational).',
    retryable: false,
  },

  // --- 8xxx Project & Collaboration ---
  [ErrorCode.PROJECT_NOT_FOUND]: {
    code: ErrorCode.PROJECT_NOT_FOUND,
    httpStatus: 404,
    severity: ErrorSeverity.ERROR,
    label: 'Project not found',
    description: 'The specified project does not exist or has been deleted.',
    retryable: false,
  },
  [ErrorCode.PROJECT_INVALID_NAME]: {
    code: ErrorCode.PROJECT_INVALID_NAME,
    httpStatus: 400,
    severity: ErrorSeverity.ERROR,
    label: 'Invalid project name',
    description: 'Project name is empty or does not meet naming requirements.',
    retryable: false,
  },
  [ErrorCode.PROJECT_DELETED]: {
    code: ErrorCode.PROJECT_DELETED,
    httpStatus: 410,
    severity: ErrorSeverity.ERROR,
    label: 'Project deleted',
    description: 'The project has been soft-deleted and is no longer accessible.',
    retryable: false,
  },
  [ErrorCode.PROJECT_BOM_NOT_FOUND]: {
    code: ErrorCode.PROJECT_BOM_NOT_FOUND,
    httpStatus: 404,
    severity: ErrorSeverity.ERROR,
    label: 'BOM item not found',
    description: 'The specified Bill of Materials item does not exist.',
    retryable: false,
  },
  [ErrorCode.PROJECT_NODE_NOT_FOUND]: {
    code: ErrorCode.PROJECT_NODE_NOT_FOUND,
    httpStatus: 404,
    severity: ErrorSeverity.ERROR,
    label: 'Architecture node not found',
    description: 'The specified architecture block/node does not exist.',
    retryable: false,
  },
  [ErrorCode.PROJECT_EDGE_NOT_FOUND]: {
    code: ErrorCode.PROJECT_EDGE_NOT_FOUND,
    httpStatus: 404,
    severity: ErrorSeverity.ERROR,
    label: 'Architecture edge not found',
    description: 'The specified architecture connection/edge does not exist.',
    retryable: false,
  },
  [ErrorCode.PROJECT_VALIDATION_NOT_FOUND]: {
    code: ErrorCode.PROJECT_VALIDATION_NOT_FOUND,
    httpStatus: 404,
    severity: ErrorSeverity.ERROR,
    label: 'Validation issue not found',
    description: 'The specified validation issue does not exist.',
    retryable: false,
  },
  [ErrorCode.PROJECT_ORDER_NOT_FOUND]: {
    code: ErrorCode.PROJECT_ORDER_NOT_FOUND,
    httpStatus: 404,
    severity: ErrorSeverity.ERROR,
    label: 'PCB order not found',
    description: 'The specified PCB fabrication order does not exist.',
    retryable: false,
  },
  [ErrorCode.PROJECT_ORDER_WRONG_STATUS]: {
    code: ErrorCode.PROJECT_ORDER_WRONG_STATUS,
    httpStatus: 400,
    severity: ErrorSeverity.ERROR,
    label: 'Order in wrong status',
    description: 'The order is not in the required status for this operation.',
    retryable: false,
  },
  [ErrorCode.COLLAB_JOIN_FAILED]: {
    code: ErrorCode.COLLAB_JOIN_FAILED,
    httpStatus: 500,
    severity: ErrorSeverity.ERROR,
    label: 'Failed to join collaboration room',
    description: 'Could not join the real-time collaboration room for this project.',
    retryable: true,
  },
  [ErrorCode.COLLAB_ENTITY_LOCKED]: {
    code: ErrorCode.COLLAB_ENTITY_LOCKED,
    httpStatus: 409,
    severity: ErrorSeverity.WARNING,
    label: 'Entity locked',
    description: 'The entity is currently being edited by another collaborator.',
    retryable: true,
  },
  [ErrorCode.COLLAB_WS_ERROR]: {
    code: ErrorCode.COLLAB_WS_ERROR,
    httpStatus: 500,
    severity: ErrorSeverity.ERROR,
    label: 'WebSocket error',
    description: 'The WebSocket connection for real-time collaboration failed.',
    retryable: true,
  },
  [ErrorCode.COLLAB_CRDT_CONFLICT]: {
    code: ErrorCode.COLLAB_CRDT_CONFLICT,
    httpStatus: 409,
    severity: ErrorSeverity.WARNING,
    label: 'CRDT conflict',
    description: 'Concurrent CRDT operations produced a conflict that needs resolution.',
    retryable: true,
  },
  [ErrorCode.PROJECT_SNAPSHOT_NOT_FOUND]: {
    code: ErrorCode.PROJECT_SNAPSHOT_NOT_FOUND,
    httpStatus: 404,
    severity: ErrorSeverity.ERROR,
    label: 'Snapshot not found',
    description: 'The specified design snapshot does not exist.',
    retryable: false,
  },
  [ErrorCode.PROJECT_LIFECYCLE_NOT_FOUND]: {
    code: ErrorCode.PROJECT_LIFECYCLE_NOT_FOUND,
    httpStatus: 404,
    severity: ErrorSeverity.ERROR,
    label: 'Lifecycle entry not found',
    description: 'The specified component lifecycle entry does not exist.',
    retryable: false,
  },

  // --- 9xxx System ---
  [ErrorCode.SYSTEM_INTERNAL]: {
    code: ErrorCode.SYSTEM_INTERNAL,
    httpStatus: 500,
    severity: ErrorSeverity.ERROR,
    label: 'Internal server error',
    description: 'An unclassified internal error occurred.',
    retryable: true,
  },
  [ErrorCode.SYSTEM_UNAVAILABLE]: {
    code: ErrorCode.SYSTEM_UNAVAILABLE,
    httpStatus: 503,
    severity: ErrorSeverity.CRITICAL,
    label: 'Service unavailable',
    description: 'The server is unavailable (shutting down, overloaded, or in maintenance).',
    retryable: true,
  },
  [ErrorCode.SYSTEM_RATE_LIMITED]: {
    code: ErrorCode.SYSTEM_RATE_LIMITED,
    httpStatus: 429,
    severity: ErrorSeverity.WARNING,
    label: 'Rate limited',
    description: 'Too many requests. Wait before retrying.',
    retryable: true,
  },
  [ErrorCode.SYSTEM_JOB_QUEUE_FULL]: {
    code: ErrorCode.SYSTEM_JOB_QUEUE_FULL,
    httpStatus: 503,
    severity: ErrorSeverity.WARNING,
    label: 'Job queue full',
    description: 'The background job queue is at capacity. Try again later.',
    retryable: true,
  },
  [ErrorCode.SYSTEM_JOB_FAILED]: {
    code: ErrorCode.SYSTEM_JOB_FAILED,
    httpStatus: 500,
    severity: ErrorSeverity.ERROR,
    label: 'Job failed',
    description: 'A background job failed to complete.',
    retryable: true,
  },
  [ErrorCode.SYSTEM_JOB_TIMEOUT]: {
    code: ErrorCode.SYSTEM_JOB_TIMEOUT,
    httpStatus: 408,
    severity: ErrorSeverity.ERROR,
    label: 'Job timed out',
    description: 'A background job exceeded its execution time limit.',
    retryable: true,
  },
  [ErrorCode.SYSTEM_EXTERNAL_SERVICE]: {
    code: ErrorCode.SYSTEM_EXTERNAL_SERVICE,
    httpStatus: 502,
    severity: ErrorSeverity.ERROR,
    label: 'External service error',
    description: 'An external service (supplier API, package manager, etc.) is unreachable.',
    retryable: true,
  },
  [ErrorCode.SYSTEM_SERIAL_ERROR]: {
    code: ErrorCode.SYSTEM_SERIAL_ERROR,
    httpStatus: 500,
    severity: ErrorSeverity.ERROR,
    label: 'Serial port error',
    description: 'A Web Serial API operation failed.',
    retryable: true,
  },
  [ErrorCode.SYSTEM_SERIAL_NOT_FOUND]: {
    code: ErrorCode.SYSTEM_SERIAL_NOT_FOUND,
    httpStatus: 404,
    severity: ErrorSeverity.ERROR,
    label: 'Serial port not found',
    description: 'The requested serial port was not found or is disconnected.',
    retryable: false,
  },
  [ErrorCode.SYSTEM_SERIAL_PERMISSION]: {
    code: ErrorCode.SYSTEM_SERIAL_PERMISSION,
    httpStatus: 403,
    severity: ErrorSeverity.ERROR,
    label: 'Serial permission denied',
    description: 'The browser denied permission to access the serial port.',
    retryable: false,
  },
  [ErrorCode.SYSTEM_INDEXEDDB_ERROR]: {
    code: ErrorCode.SYSTEM_INDEXEDDB_ERROR,
    httpStatus: 500,
    severity: ErrorSeverity.ERROR,
    label: 'IndexedDB error',
    description: 'An IndexedDB operation (offline storage) failed.',
    retryable: true,
  },
  [ErrorCode.SYSTEM_SW_ERROR]: {
    code: ErrorCode.SYSTEM_SW_ERROR,
    httpStatus: 500,
    severity: ErrorSeverity.ERROR,
    label: 'Service worker error',
    description: 'Service worker registration or cache operation failed.',
    retryable: true,
  },
  [ErrorCode.SYSTEM_API_NOT_FOUND]: {
    code: ErrorCode.SYSTEM_API_NOT_FOUND,
    httpStatus: 404,
    severity: ErrorSeverity.ERROR,
    label: 'API route not found',
    description: 'The requested API endpoint does not exist.',
    retryable: false,
  },
  [ErrorCode.SYSTEM_CSP_VIOLATION]: {
    code: ErrorCode.SYSTEM_CSP_VIOLATION,
    httpStatus: 200,
    severity: ErrorSeverity.WARNING,
    label: 'CSP violation',
    description: 'A Content-Security-Policy violation was reported.',
    retryable: false,
  },
  [ErrorCode.SYSTEM_SHUTTING_DOWN]: {
    code: ErrorCode.SYSTEM_SHUTTING_DOWN,
    httpStatus: 503,
    severity: ErrorSeverity.CRITICAL,
    label: 'Server shutting down',
    description: 'The server is performing a graceful shutdown and is not accepting new work.',
    retryable: true,
  },
};

// ---------------------------------------------------------------------------
// ProtoPulseError — structured error class that carries a stable code
// ---------------------------------------------------------------------------

export interface ProtoPulseErrorOptions {
  /** Human-readable detail message (overrides catalog default label). */
  detail?: string;
  /** Arbitrary context data (e.g. field names, IDs, limits). */
  context?: Record<string, unknown>;
  /** The original error that caused this one. */
  cause?: unknown;
}

export class ProtoPulseError extends Error {
  /** Stable error code from the ErrorCode enum. */
  readonly code: ErrorCode;
  /** HTTP status to use in API responses. */
  readonly httpStatus: number;
  /** Error severity level. */
  readonly severity: ErrorSeverity;
  /** Short label from the catalog. */
  readonly label: string;
  /** Whether the operation is safe to retry. */
  readonly retryable: boolean;
  /** Arbitrary structured context data. */
  readonly context: Record<string, unknown>;

  constructor(code: ErrorCode, options: ProtoPulseErrorOptions = {}) {
    const entry = errorCatalog[code];
    const message = options.detail ?? entry.label;
    super(message);
    this.name = 'ProtoPulseError';
    this.code = code;
    this.httpStatus = entry.httpStatus;
    this.severity = entry.severity;
    this.label = entry.label;
    this.retryable = entry.retryable;
    this.context = options.context ?? {};

    if (options.cause instanceof Error) {
      this.stack = options.cause.stack;
    }
  }

  /**
   * Serialize to a JSON-safe API response payload.
   * Suitable for `res.status(err.httpStatus).json(err.toJSON())`.
   */
  toJSON(): {
    error: {
      code: string;
      label: string;
      message: string;
      retryable: boolean;
      context: Record<string, unknown>;
    };
  } {
    return {
      error: {
        code: this.code,
        label: this.label,
        message: this.message,
        retryable: this.retryable,
        context: this.context,
      },
    };
  }
}

// ---------------------------------------------------------------------------
// Utility: look up a catalog entry by code string (for logging / error pages)
// ---------------------------------------------------------------------------

/**
 * Retrieve the catalog entry for a given error code string.
 * Returns `undefined` if the code is not in the taxonomy.
 */
export function lookupErrorCode(code: string): ErrorCatalogEntry | undefined {
  return errorCatalog[code as ErrorCode];
}

/**
 * Check whether a string is a valid ProtoPulse error code.
 */
export function isValidErrorCode(code: string): code is ErrorCode {
  return code in errorCatalog;
}

/**
 * Get all error codes for a given domain (e.g. '1' for auth, '5' for circuit).
 */
export function getErrorCodesByDomain(domainDigit: string): ErrorCatalogEntry[] {
  const prefix = `PP-${domainDigit}`;
  return Object.values(errorCatalog).filter((entry) => entry.code.startsWith(prefix));
}

/**
 * Map a PostgreSQL error code to the corresponding ProtoPulse storage error code.
 */
export function pgCodeToErrorCode(pgCode: string | undefined): ErrorCode {
  if (!pgCode) { return ErrorCode.STORAGE_ERROR; }
  switch (pgCode) {
    case '23505': return ErrorCode.STORAGE_DUPLICATE;
    case '23503': return ErrorCode.STORAGE_FK_VIOLATION;
    case '23502': return ErrorCode.STORAGE_NOT_NULL_VIOLATION;
    case '23514': return ErrorCode.STORAGE_CHECK_VIOLATION;
    case '57014': return ErrorCode.STORAGE_QUERY_TIMEOUT;
    case '08006':
    case '08001':
    case '08004':
      return ErrorCode.STORAGE_CONNECTION_FAILED;
    case '57P01':
      return ErrorCode.STORAGE_SERVER_SHUTDOWN;
    case '40001':
    case '40P01':
      return ErrorCode.STORAGE_TRANSACTION_ABORTED;
    default: return ErrorCode.STORAGE_ERROR;
  }
}
