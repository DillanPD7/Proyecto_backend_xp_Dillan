import type { Request, RequestHandler } from "express";
import { AppError } from "../domain/errors";
import type { UserRole } from "../domain/models";
import type { AuthIdentity, AuthService } from "./auth-service";

interface AuthenticatedRequest extends Request {
  authUser?: AuthIdentity;
}

export function getAuthIdentity(request: Request): AuthIdentity {
  const identity = (request as AuthenticatedRequest).authUser;
  if (!identity) {
    throw new AppError("Autenticación requerida", 401);
  }
  return identity;
}

export function requireAuth(authService: AuthService): RequestHandler {
  return (request, response, next) => {
    const authorization = request.get("authorization");
    const match = authorization?.match(/^Bearer ([^\s]+)$/i);
    if (!match) {
      response.status(401).json({ error: "Acceso denegado. Se requiere un token Bearer." });
      return;
    }
    try {
      (request as AuthenticatedRequest).authUser = authService.verifyAccessToken(match[1]);
      next();
    } catch (error) {
      next(error);
    }
  };
}

export function requireRole(...roles: UserRole[]): RequestHandler {
  return (request, response, next) => {
    const authUser = (request as AuthenticatedRequest).authUser;
    if (!authUser || !roles.includes(authUser.role)) {
      response.status(403).json({ error: "No tienes los permisos necesarios." });
      return;
    }
    next();
  };
}
