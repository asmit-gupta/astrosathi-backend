export interface AuthContext {
  userId: string;
  sessionId: string;
  roles: string[];
  app: 'user' | 'provider';
}

import type { AdminContext } from '../modules/admin/adminAuth.service';

declare global {
  namespace Express {
    interface Request {
      id: string;
      auth?: AuthContext;
      admin?: AdminContext;
    }
  }
}
