/// <reference types="express" />
/// <reference types="multer" />

declare global {
  namespace Express {
    interface Request {
      user?: {
        userId: string;
        phone?: string;
      };
    }
  }
}

export {};

