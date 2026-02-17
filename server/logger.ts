type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LOG_LEVELS: Record<LogLevel, number> = { debug: 10, info: 20, warn: 30, error: 40 };

const minLevel = (process.env.LOG_LEVEL as LogLevel) || 'info';

function shouldLog(level: LogLevel): boolean {
  return LOG_LEVELS[level] >= LOG_LEVELS[minLevel];
}

interface LogEntry {
  level: LogLevel;
  time: string;
  msg: string;
  [key: string]: unknown;
}

function emit(entry: LogEntry): void {
  const output = JSON.stringify(entry);
  if (entry.level === 'error') {
    process.stderr.write(output + '\n');
  } else {
    process.stdout.write(output + '\n');
  }
}

export const logger = {
  debug(msg: string, data?: Record<string, unknown>) {
    if (shouldLog('debug')) emit({ level: 'debug', time: new Date().toISOString(), msg, ...data });
  },
  info(msg: string, data?: Record<string, unknown>) {
    if (shouldLog('info')) emit({ level: 'info', time: new Date().toISOString(), msg, ...data });
  },
  warn(msg: string, data?: Record<string, unknown>) {
    if (shouldLog('warn')) emit({ level: 'warn', time: new Date().toISOString(), msg, ...data });
  },
  error(msg: string, data?: Record<string, unknown>) {
    if (shouldLog('error')) emit({ level: 'error', time: new Date().toISOString(), msg, ...data });
  },
};
