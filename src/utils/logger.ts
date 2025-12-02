/**
 * The Joker - Agentic Terminal
 * Winston Logger Configuration
 */

import winston from 'winston';
import path from 'path';
import fs from 'fs';
import { logConfig, paths } from './config';

// Ensure logs directory exists
if (!fs.existsSync(paths.logs)) {
  fs.mkdirSync(paths.logs, { recursive: true });
}

/**
 * Custom log format
 */
const customFormat = winston.format.printf(({ level, message, timestamp, ...meta }) => {
  let msg = `${timestamp} [${level.toUpperCase()}] ${message}`;
  if (Object.keys(meta).length > 0) {
    msg += ` ${JSON.stringify(meta)}`;
  }
  return msg;
});

/**
 * Console format with colors
 */
const consoleFormat = winston.format.combine(
  winston.format.colorize({ all: true }),
  winston.format.timestamp({ format: 'HH:mm:ss' }),
  winston.format.printf(({ level, message, timestamp }) => {
    return `${timestamp} ${level}: ${message}`;
  })
);

/**
 * File format
 */
const fileFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  customFormat
);

/**
 * Create Winston logger instance
 */
export const logger = winston.createLogger({
  level: logConfig.level,
  format: fileFormat,
  transports: [
    // Console transport
    new winston.transports.Console({
      format: consoleFormat,
      silent: process.env.NODE_ENV === 'test',
    }),
    // File transport - all logs
    new winston.transports.File({
      filename: path.join(paths.logs, 'joker.log'),
      maxsize: parseInt(logConfig.maxSize || '10') * 1024 * 1024, // 10MB default
      maxFiles: logConfig.maxFiles,
      tailable: true,
    }),
    // File transport - errors only
    new winston.transports.File({
      filename: path.join(paths.logs, 'error.log'),
      level: 'error',
      maxsize: parseInt(logConfig.maxSize || '10') * 1024 * 1024,
      maxFiles: logConfig.maxFiles,
      tailable: true,
    }),
  ],
  exceptionHandlers: [
    new winston.transports.File({
      filename: path.join(paths.logs, 'exceptions.log'),
    }),
  ],
  rejectionHandlers: [
    new winston.transports.File({
      filename: path.join(paths.logs, 'rejections.log'),
    }),
  ],
});

/**
 * Log levels helper
 */
export const log = {
  error: (message: string, meta?: Record<string, unknown>) => logger.error(message, meta),
  warn: (message: string, meta?: Record<string, unknown>) => logger.warn(message, meta),
  info: (message: string, meta?: Record<string, unknown>) => logger.info(message, meta),
  debug: (message: string, meta?: Record<string, unknown>) => logger.debug(message, meta),
  verbose: (message: string, meta?: Record<string, unknown>) => logger.verbose(message, meta),
};

export default logger;
