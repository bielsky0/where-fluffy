export type AppError = Error & { statusCode: number; isOperational: boolean };

export const createAppError = (statusCode: number, message: string, isOperational = true): AppError => {
  const error = new Error(message) as AppError;
  error.statusCode = statusCode;
  error.isOperational = isOperational;
  return error;
};

export const isAppError = (err: unknown): err is AppError =>
  err instanceof Error &&
  typeof (err as AppError).statusCode === 'number' &&
  typeof (err as AppError).isOperational === 'boolean';
