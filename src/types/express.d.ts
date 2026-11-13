export interface AuthContext {
  userId: string;
  sessionId: string;
  roles: string[];
}

declare global {
  namespace Express {
    interface Request {
      id: string;
      auth?: AuthContext;
    }
  }
}
