import winston from 'winston';

const isDevelopment = process.env.NODE_ENV === 'development';
const logLevel = process.env.LOG_LEVEL || (isDevelopment ? 'debug' : 'info');

// Custom format for better readability
const customFormat = winston.format.printf(({ level, message, timestamp, ...meta }) => {
  let logMessage = `${timestamp} [${level.toUpperCase()}]: ${message}`;
  
  if (Object.keys(meta).length > 0) {
    logMessage += ` ${JSON.stringify(meta, null, 2)}`;
  }
  
  return logMessage;
});

// Create the logger
export const logger = winston.createLogger({
  level: logLevel,
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'codeguide-app' },
  transports: [
    // Write all logs to console in development
    new winston.transports.Console({
      format: isDevelopment
        ? winston.format.combine(
            winston.format.colorize(),
            winston.format.timestamp({ format: 'HH:mm:ss' }),
            customFormat
          )
        : winston.format.json(),
    }),
  ],
});

// Add file transports in production
if (!isDevelopment) {
  logger.add(
    new winston.transports.File({
      filename: 'logs/error.log',
      level: 'error',
      format: winston.format.json(),
    })
  );

  logger.add(
    new winston.transports.File({
      filename: 'logs/combined.log',
      format: winston.format.json(),
    })
  );
}

// Create log directory if it doesn't exist (for production)
if (!isDevelopment) {
  const fs = require('fs');
  const path = require('path');
  
  const logDir = 'logs';
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir);
  }
}

// Helper functions for structured logging
export const loggers = {
  auth: logger.child({ module: 'auth' }),
  api: logger.child({ module: 'api' }),
  database: logger.child({ module: 'database' }),
  cache: logger.child({ module: 'cache' }),
  email: logger.child({ module: 'email' }),
  storage: logger.child({ module: 'storage' }),
  ai: logger.child({ module: 'ai' }),
  socket: logger.child({ module: 'socket' }),
};

// Request logging middleware helper
export function logRequest(req: any, res: any, responseTime: number) {
  const { method, url, headers, query, body } = req;
  const { statusCode } = res;
  
  logger.info('HTTP Request', {
    method,
    url,
    statusCode,
    responseTime: `${responseTime}ms`,
    userAgent: headers['user-agent'],
    ip: headers['x-forwarded-for'] || req.connection?.remoteAddress,
    query: Object.keys(query).length > 0 ? query : undefined,
    bodySize: JSON.stringify(body || {}).length,
  });
}

// Error logging helper
export function logError(error: Error, context?: Record<string, any>) {
  logger.error('Application Error', {
    message: error.message,
    stack: error.stack,
    name: error.name,
    ...context,
  });
}

// Performance logging helper
export function logPerformance(operation: string, duration: number, metadata?: Record<string, any>) {
  logger.info('Performance Metric', {
    operation,
    duration: `${duration}ms`,
    ...metadata,
  });
}

// Security event logging
export function logSecurityEvent(event: string, details: Record<string, any>) {
  logger.warn('Security Event', {
    event,
    timestamp: new Date().toISOString(),
    ...details,
  });
}

export default logger;