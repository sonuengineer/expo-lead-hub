import { Request, Response, NextFunction, RequestHandler } from "express";

// Wrapper to handle async errors in route handlers
export function asyncHandler(fn: RequestHandler): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
