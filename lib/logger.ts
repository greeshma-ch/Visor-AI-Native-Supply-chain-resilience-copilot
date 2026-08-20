/**
 * VISOR Structured Logger
 * Provides request tracing, latency measurement, and error telemetry.
 */

export enum LogLevel {
  DEBUG = 'DEBUG',
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'ERROR',
  FATAL = 'FATAL',
}

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  agent?: string;
  operation: string;
  message: string;
  durationMs?: number;
  meta?: Record<string, unknown>;
  traceId?: string;
}

let globalTraceId: string | undefined;

const generateTraceId = (): string =>
  `visor-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

export const setTraceId = (id?: string): string => {
  globalTraceId = id || generateTraceId();
  return globalTraceId;
};

export const getTraceId = (): string | undefined => globalTraceId;

const formatEntry = (entry: LogEntry): string => {
  const parts = [
    `[${entry.timestamp}]`,
    `[${entry.level}]`,
    entry.agent ? `[${entry.agent}]` : '',
    `[${entry.operation}]`,
    entry.message,
    entry.durationMs !== undefined ? `(${entry.durationMs}ms)` : '',
    entry.traceId ? `trace=${entry.traceId}` : '',
  ].filter(Boolean);
  return parts.join(' ');
};

const log = (level: LogLevel, agent: string | undefined, operation: string, message: string, meta?: Record<string, unknown>) => {
  const entry: LogEntry = {
    timestamp: new Date().toISOString(),
    level,
    agent,
    operation,
    message,
    meta,
    traceId: globalTraceId,
  };

  const formatted = formatEntry(entry);

  switch (level) {
    case LogLevel.ERROR:
    case LogLevel.FATAL:
      console.error(formatted, meta ? JSON.stringify(meta) : '');
      break;
    case LogLevel.WARN:
      console.warn(formatted, meta ? JSON.stringify(meta) : '');
      break;
    default:
      console.log(formatted, meta ? JSON.stringify(meta) : '');
  }

  return entry;
};

/**
 * Creates a scoped logger for a specific agent or module.
 */
export const createLogger = (agentName: string) => ({
  debug: (op: string, msg: string, meta?: Record<string, unknown>) => log(LogLevel.DEBUG, agentName, op, msg, meta),
  info: (op: string, msg: string, meta?: Record<string, unknown>) => log(LogLevel.INFO, agentName, op, msg, meta),
  warn: (op: string, msg: string, meta?: Record<string, unknown>) => log(LogLevel.WARN, agentName, op, msg, meta),
  error: (op: string, msg: string, meta?: Record<string, unknown>) => log(LogLevel.ERROR, agentName, op, msg, meta),
  fatal: (op: string, msg: string, meta?: Record<string, unknown>) => log(LogLevel.FATAL, agentName, op, msg, meta),
});

/**
 * Measures the duration of an async operation and logs it.
 */
export const withTelemetry = async <T>(
  logger: ReturnType<typeof createLogger>,
  operation: string,
  fn: () => Promise<T>,
  meta?: Record<string, unknown>
): Promise<{ result: T; durationMs: number }> => {
  const start = performance.now();
  logger.info(operation, `Starting ${operation}`, meta);

  try {
    const result = await fn();
    const durationMs = Math.round(performance.now() - start);
    logger.info(operation, `Completed ${operation}`, { ...meta, durationMs });
    return { result, durationMs };
  } catch (error: any) {
    const durationMs = Math.round(performance.now() - start);
    logger.error(operation, `Failed ${operation}: ${error?.message}`, { ...meta, durationMs, errorType: error?.constructor?.name });
    throw error;
  }
};
