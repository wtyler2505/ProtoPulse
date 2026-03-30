/**
 * ProtoPulse error code enum — every code is a stable, documented identifier.
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
 */

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
