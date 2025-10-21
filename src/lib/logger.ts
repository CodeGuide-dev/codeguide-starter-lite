import { createSupabaseServerClient } from './supabase';

export enum LogLevel {
  ERROR = 0,
  WARN = 1,
  INFO = 2,
  DEBUG = 3,
}

export interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: Date;
  userId?: string;
  metadata?: Record<string, any>;
  stack?: string;
  requestId?: string;
}

class Logger {
  private isDevelopment = process.env.NODE_ENV === 'development';
  
  private formatLog(entry: LogEntry): string {
    const timestamp = entry.timestamp.toISOString();
    const level = LogLevel[entry.level];
    const userId = entry.userId ? ` [User: ${entry.userId}]` : '';
    const requestId = entry.requestId ? ` [Request: ${entry.requestId}]` : '';
    const metadata = entry.metadata ? ` ${JSON.stringify(entry.metadata)}` : '';
    
    return `[${timestamp}] ${level}${userId}${requestId}: ${entry.message}${metadata}`;
  }

  private async persistLog(entry: LogEntry): Promise<void> {
    try {
      const supabase = await createSupabaseServerClient();
      await supabase.from('application_logs').insert({
        level: LogLevel[entry.level].toLowerCase(),
        message: entry.message,
        user_id: entry.userId,
        metadata: entry.metadata,
        stack_trace: entry.stack,
        request_id: entry.requestId,
        created_at: entry.timestamp.toISOString(),
      });
    } catch (error) {
      // Fallback to console if database logging fails
      console.error('Failed to persist log:', error);
    }
  }

  private log(level: LogLevel, message: string, metadata?: Record<string, any>, userId?: string, requestId?: string): void {
    const entry: LogEntry = {
      level,
      message,
      timestamp: new Date(),
      userId,
      metadata,
      requestId,
    };

    // Always log to console in development
    if (this.isDevelopment || level <= LogLevel.WARN) {
      const consoleMethod = level === LogLevel.ERROR ? console.error : 
                           level === LogLevel.WARN ? console.warn : 
                           console.log;
      consoleMethod(this.formatLog(entry));
    }

    // Persist logs to database in production
    if (!this.isDevelopment && level <= LogLevel.INFO) {
      this.persistLog(entry);
    }
  }

  error(message: string, metadata?: Record<string, any>, userId?: string, requestId?: string): void {
    const error = metadata?.error;
    const entry: LogEntry = {
      level: LogLevel.ERROR,
      message,
      timestamp: new Date(),
      userId,
      metadata,
      stack: error?.stack,
      requestId,
    };

    console.error(this.formatLog(entry));
    if (error) {
      console.error(error.stack);
    }

    // Always persist errors
    this.persistLog(entry);
  }

  warn(message: string, metadata?: Record<string, any>, userId?: string, requestId?: string): void {
    this.log(LogLevel.WARN, message, metadata, userId, requestId);
  }

  info(message: string, metadata?: Record<string, any>, userId?: string, requestId?: string): void {
    this.log(LogLevel.INFO, message, metadata, userId, requestId);
  }

  debug(message: string, metadata?: Record<string, any>, userId?: string, requestId?: string): void {
    this.log(LogLevel.DEBUG, message, metadata, userId, requestId);
  }
}

export const logger = new Logger();

// Error handling utilities
export class AppError extends Error {
  public statusCode: number;
  public isOperational: boolean;
  public userId?: string;

  constructor(message: string, statusCode: number = 500, isOperational: boolean = true, userId?: string) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.userId = userId;

    Error.captureStackTrace(this, this.constructor);
  }
}

export const handleAsyncError = (fn: Function) => {
  return (...args: any[]) => {
    const fnReturn = fn(...args);
    const next = args[args.length - 1];
    return Promise.resolve(fnReturn).catch(next);
  };
};

// API response helper
export class ApiResponse {
  static success<T>(data: T, message: string = 'Success', statusCode: number = 200) {
    return {
      success: true,
      statusCode,
      message,
      data,
    };
  }

  static error(message: string, statusCode: number = 500, details?: any) {
    return {
      success: false,
      statusCode,
      message,
      error: details,
    };
  }
}

// Request ID generator
export const generateRequestId = (): string => {
  return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};