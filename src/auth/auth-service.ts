import { randomUUID } from "node:crypto";
import bcrypt from "bcrypt";
import jwt, { type JwtPayload } from "jsonwebtoken";
import { AppError } from "../domain/errors";
import type { AuthUser, UserRole } from "../domain/models";
import { MemoryRepository } from "../data/memory-repository";

const ACCESS_TOKEN_TTL_SECONDS = 15 * 60;
const REFRESH_TOKEN_TTL_SECONDS = 7 * 24 * 60 * 60;
const BCRYPT_ROUNDS = 12;
const DUMMY_PASSWORD_HASH = bcrypt.hashSync("invalid-password-for-timing", BCRYPT_ROUNDS);

function isUserRole(role: unknown): role is UserRole {
  return role === "USER" || role === "EDITOR" || role === "ADMIN";
}

export interface AuthConfig {
  jwtSecret: string;
  adminEmail?: string;
  adminPassword?: string;
}

export interface AuthIdentity {
  id: string;
  role: UserRole;
}

export class AuthService {
  constructor(
    private readonly repository: MemoryRepository,
    private readonly config: AuthConfig,
  ) {
    if (Boolean(config.adminEmail) !== Boolean(config.adminPassword)) {
      throw new Error("ADMIN_EMAIL y ADMIN_PASSWORD deben configurarse juntos");
    }
    if (config.adminEmail && config.adminPassword) {
      if (
        !this.isValidEmail(config.adminEmail) ||
        config.adminPassword.length < 12 ||
        Buffer.byteLength(config.adminPassword, "utf8") > 72
      ) {
        throw new Error("Las credenciales iniciales del administrador no son válidas");
      }
      const email = config.adminEmail.trim().toLowerCase();
      const existingAdmin = repository.getAuthUserByEmail(email);
      if (existingAdmin && existingAdmin.role !== "ADMIN") {
        throw new Error("ADMIN_EMAIL ya está asociado a una cuenta sin rol ADMIN");
      }
      if (!existingAdmin) {
        repository.saveAuthUser({
          id: randomUUID(),
          name: "Administrador",
          email,
          passwordHash: bcrypt.hashSync(config.adminPassword, BCRYPT_ROUNDS),
          role: "ADMIN",
        });
      }
    }
  }

  async register(input: unknown): Promise<{ id: string; name: string; email: string; role: UserRole }> {
    const body = this.validateObject(input, ["name", "email", "password"]);
    const name = body.name;
    const email = body.email;
    const password = body.password;
    if (
      typeof name !== "string" ||
      name.trim().length < 1 ||
      name.trim().length > 80 ||
      typeof email !== "string" ||
      !this.isValidEmail(email) ||
      typeof password !== "string" ||
      password.length < 12 ||
      Buffer.byteLength(password, "utf8") > 72
    ) {
      throw new AppError("Nombre, email válido y contraseña de 12 caracteres a 72 bytes son obligatorios", 400);
    }

    const normalizedEmail = email.trim().toLowerCase();
    if (this.repository.getAuthUserByEmail(normalizedEmail)) {
      throw new AppError("El email ya está registrado", 409);
    }
    const user: AuthUser = {
      id: randomUUID(),
      name: name.trim(),
      email: normalizedEmail,
      passwordHash: await bcrypt.hash(password, BCRYPT_ROUNDS),
      role: "USER",
    };
    if (!this.repository.saveAuthUser(user)) {
      throw new AppError("El email ya está registrado", 409);
    }
    return this.publicUser(user);
  }

  async login(input: unknown): Promise<ReturnType<AuthService["issueTokens"]>> {
    const body = this.validateObject(input, ["email", "password"]);
    if (typeof body.email !== "string" || typeof body.password !== "string") {
      throw new AppError("Email y contraseña son obligatorios", 400);
    }
    const user = this.repository.getAuthUserByEmail(body.email.trim().toLowerCase());
    const passwordMatches = await bcrypt.compare(
      body.password,
      user?.passwordHash ?? DUMMY_PASSWORD_HASH,
    );
    if (!user || !passwordMatches) {
      throw new AppError("Credenciales inválidas", 401);
    }
    return this.issueTokens(user);
  }

  refresh(input: unknown): ReturnType<AuthService["issueTokens"]> {
    const body = this.validateObject(input, ["refreshToken"]);
    if (typeof body.refreshToken !== "string") {
      throw new AppError("Refresh token obligatorio", 400);
    }
    const payload = this.verifyToken(body.refreshToken);
    if (
      typeof payload === "string" ||
      payload.type !== "refresh" ||
      typeof payload.sub !== "string" ||
      typeof payload.jti !== "string"
    ) {
      throw new AppError("Refresh token inválido o expirado", 401);
    }
    const userId = this.repository.consumeRefreshToken(payload.jti, Date.now());
    const user = userId === payload.sub ? this.repository.getAuthUserById(userId) : undefined;
    if (!user) {
      throw new AppError("Refresh token inválido o expirado", 401);
    }
    return this.issueTokens(user);
  }

  verifyAccessToken(token: string): AuthIdentity {
    const payload = this.verifyToken(token);
    if (
      typeof payload === "string" ||
      payload.type !== "access" ||
      typeof payload.sub !== "string" ||
      !isUserRole(payload.role)
    ) {
      throw new AppError("Token inválido o expirado", 403);
    }
    return { id: payload.sub, role: payload.role };
  }

  getPublicUser(id: string): { id: string; name: string; email: string; role: UserRole } {
    const user = this.repository.getAuthUserById(id);
    if (!user) {
      throw new AppError("Usuario no encontrado", 404);
    }
    return this.publicUser(user);
  }

  private issueTokens(user: AuthUser): {
    accessToken: string;
    refreshToken: string;
    tokenType: "Bearer";
    expiresIn: number;
    user: { id: string; name: string; email: string; role: UserRole };
  } {
    const accessToken = jwt.sign(
      { type: "access", role: user.role },
      this.config.jwtSecret,
      {
        subject: user.id,
        jwtid: randomUUID(),
        expiresIn: ACCESS_TOKEN_TTL_SECONDS,
        algorithm: "HS256",
      },
    );
    const jti = randomUUID();
    const refreshExpiresAt = Date.now() + REFRESH_TOKEN_TTL_SECONDS * 1000;
    const refreshToken = jwt.sign(
      { type: "refresh" },
      this.config.jwtSecret,
      { subject: user.id, jwtid: jti, expiresIn: REFRESH_TOKEN_TTL_SECONDS, algorithm: "HS256" },
    );
    this.repository.storeRefreshToken(jti, user.id, refreshExpiresAt);
    return {
      accessToken,
      refreshToken,
      tokenType: "Bearer",
      expiresIn: ACCESS_TOKEN_TTL_SECONDS,
      user: this.publicUser(user),
    };
  }

  private verifyToken(token: string): string | JwtPayload {
    try {
      return jwt.verify(token, this.config.jwtSecret, { algorithms: ["HS256"] });
    } catch {
      throw new AppError("Token inválido o expirado", 401);
    }
  }

  private validateObject(
    input: unknown,
    allowedKeys: string[],
  ): Record<string, unknown> {
    if (
      typeof input !== "object" ||
      input === null ||
      Array.isArray(input) ||
      Object.keys(input).some((key) => !allowedKeys.includes(key))
    ) {
      throw new AppError("El cuerpo de la solicitud no es válido", 400);
    }
    return input as Record<string, unknown>;
  }

  private publicUser(user: AuthUser): { id: string; name: string; email: string; role: UserRole } {
    return { id: user.id, name: user.name, email: user.email, role: user.role };
  }

  private isValidEmail(email: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  }
}
