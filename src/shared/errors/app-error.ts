export type AppError = Error & { statusCode: number; isOperational: boolean; code?: string };

export const createAppError = (
  statusCode: number,
  message: string,
  isOperational = true,
  code?: string,
): AppError => {
  const error = new Error(message) as AppError;
  error.statusCode = statusCode;
  error.isOperational = isOperational;
  if (code) error.code = code;
  return error;
};

export const isAppError = (err: unknown): err is AppError =>
  err instanceof Error &&
  typeof (err as AppError).statusCode === 'number' &&
  typeof (err as AppError).isOperational === 'boolean';
