import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';

export const validateBody = (schema: ZodSchema) => {
    return (req: Request, res: Response, next: NextFunction): void => {
        try {
            req.body = schema.parse(req.body);
            next();
        } catch (error: any) {
            if (error instanceof ZodError) {
                const issues = error.issues || [];
                const formattedErrors = issues.map((issue: any) => ({
                    field: issue.path ? issue.path.join('.') : '',
                    message: issue.message
                }));
                res.status(400).json({
                    success: false,
                    error: 'Validation failed',
                    details: formattedErrors
                });
                return;
            }
            res.status(400).json({ success: false, error: 'Malformed request payload' });
        }
    };
};
