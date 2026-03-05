function mapPgCodeToHttp(code: string | undefined): number {
  if (!code) { return 500; }
  switch (code) {
    case '23505': return 409; // unique_violation
    case '23503': return 400; // foreign_key_violation
    case '23502': return 400; // not_null_violation
    case '23514': return 400; // check_violation
    case '57014': return 408; // query_canceled (timeout)
    case '08006': // connection_failure
    case '08001': // sqlclient_unable_to_establish_sqlconnection
    case '08004': // sqlserver_rejected_establishment
    case '57P01': // admin_shutdown
      return 503;
    default: return 500;
  }
}

export class StorageError extends Error {
  public readonly httpStatus: number;
  public readonly pgCode: string | null;

  constructor(operation: string, entity: string, cause?: unknown) {
    const causeMsg = cause instanceof Error ? cause.message : String(cause);
    super(`Storage.${operation}(${entity}) failed: ${causeMsg}`);
    this.name = 'StorageError';
    if (cause instanceof Error) { this.stack = cause.stack; }

    const code = (cause as Record<string, unknown> | null | undefined)?.code as string | undefined;
    this.pgCode = code ?? null;
    this.httpStatus = mapPgCodeToHttp(code);
  }
}

export class VersionConflictError extends StorageError {
  public override readonly httpStatus = 409;
  public readonly currentVersion: number;

  constructor(entity: string, id: number, currentVersion: number) {
    super('update', `${entity}/${id}`, new Error('Version conflict — resource was modified by another request'));
    this.name = 'VersionConflictError';
    this.currentVersion = currentVersion;
  }
}
