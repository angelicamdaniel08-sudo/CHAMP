/**
 * Centralized error handler middleware for Express
 */
function errorHandler(err, req, res, next) {
  console.error(`[Error] ${req.method} ${req.originalUrl}:`, err);

  // Handle Prisma Known Request Errors
  if (err.code) {
    switch (err.code) {
      case 'P2002': {
        const target = err.meta?.target || 'field';
        return res.status(409).json({
          success: false,
          error: `A unique constraint failed on the ${target}`,
          code: err.code
        });
      }
      case 'P2025': {
        return res.status(404).json({
          success: false,
          error: err.meta?.cause || 'Record not found in the database',
          code: err.code
        });
      }
      case 'P2003': {
        return res.status(400).json({
          success: false,
          error: 'Foreign key constraint failed. Related record does not exist.',
          code: err.code
        });
      }
      default:
        break;
    }
  }

  // Handle SyntaxError (JSON body parsing)
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return res.status(400).json({
      success: false,
      error: 'Invalid JSON payload in request body'
    });
  }

  // General fallback
  const statusCode = err.status || err.statusCode || 500;
  return res.status(statusCode).json({
    success: false,
    error: err.message || 'Internal Server Error',
    details: process.env.NODE_ENV === 'development' ? err.stack : undefined
  });
}

module.exports = errorHandler;
