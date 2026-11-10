import { randomBytes } from "node:crypto";
import cors from "cors";
import express, {
  type ErrorRequestHandler,
  type RequestHandler,
} from "express";
import { rateLimit } from "express-rate-limit";
import helmet from "helmet";
import swaggerUi from "swagger-ui-express";
import { AuthService } from "./auth/auth-service";
import { getAuthIdentity, requireAuth, requireRole } from "./auth/auth-middleware";
import { MemoryRepository } from "./data/memory-repository";
import { AppError } from "./domain/errors";
import { openApiDocument } from "./docs/openapi";
import { CoworkingService } from "./services/coworking-service";

type AsyncRequestHandler = (
  request: express.Request,
  response: express.Response,
  next: express.NextFunction,
) => void | Promise<void>;

export interface AppOptions {
  jwtSecret?: string;
  corsOrigins?: string[];
  adminEmail?: string;
  adminPassword?: string;
}

function route(handler: AsyncRequestHandler): RequestHandler {
  return (request, response, next) => {
    Promise.resolve(handler(request, response, next)).catch(next);
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function reservationOwner(service: CoworkingService): RequestHandler {
  return (request, _response, next) => {
    try {
      const reservation = service.getReservation(request.params.id);
      const identity = getAuthIdentity(request);
      if (identity.role !== "ADMIN" && reservation.userId !== identity.id) {
        throw new AppError("No tienes permisos para acceder a esta reserva", 403);
      }
      next();
    } catch (error) {
      next(error);
    }
  };
}

export function createApp(
  repository = new MemoryRepository(),
  options: AppOptions = {},
): express.Express {
  const app = express();
  const service = new CoworkingService(repository);
  const authService = new AuthService(repository, {
    jwtSecret: options.jwtSecret ?? process.env.JWT_SECRET ?? randomBytes(32).toString("hex"),
    adminEmail: options.adminEmail ?? process.env.ADMIN_EMAIL,
    adminPassword: options.adminPassword ?? process.env.ADMIN_PASSWORD,
  });
  const allowedOrigins = options.corsOrigins ??
    (process.env.CORS_ORIGINS ?? "")
      .split(",")
      .map((origin) => origin.trim())
      .filter(Boolean);

  app.use(helmet());
  app.use(cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }
      callback(new AppError("Origen no permitido por la política CORS", 403));
    },
    methods: ["GET", "POST", "DELETE", "OPTIONS"],
    allowedHeaders: ["Authorization", "Content-Type"],
  }));
  app.use(express.json({ limit: "10kb" }));

  app.get("/health", (_request, response) => {
    response.json({ status: "ok" });
  });

  const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 5,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (_request, response) => {
      response.status(429).json({ error: "Demasiados intentos de inicio de sesión. Intenta más tarde." });
    },
  });
  const authenticated = requireAuth(authService);

  app.post("/api/auth/register", route(async (request, response) => {
    const user = await authService.register(request.body);
    response.status(201).json({ mensaje: "Usuario registrado exitosamente", user });
  }));
  app.post("/api/auth/login", loginLimiter, route(async (request, response) => {
    response.json(await authService.login(request.body));
  }));
  app.post("/api/auth/refresh", route((request, response) => {
    response.json(authService.refresh(request.body));
  }));
  app.get("/api/profile", authenticated, route((request, response) => {
    response.json(authService.getPublicUser(getAuthIdentity(request).id));
  }));

  app.get("/api/rooms", route((request, response) => {
    const date = request.query.date;
    if (typeof date !== "string") {
      throw new AppError("El parámetro date es obligatorio", 400);
    }
    response.json(service.listAvailableRooms(date));
  }));
  app.post("/api/reservations", authenticated, route((request, response) => {
    if (!isRecord(request.body)) {
      throw new AppError("roomId y date son obligatorios", 400);
    }
    const { roomId, date, userId } = request.body;
    if (typeof roomId !== "string" || typeof date !== "string") {
      throw new AppError("roomId y date son obligatorios", 400);
    }
    if (Object.keys(request.body).some((key) => !["roomId", "date", "userId"].includes(key))) {
      throw new AppError("El cuerpo de la solicitud no es válido", 400);
    }
    const identity = getAuthIdentity(request);
    if (userId !== undefined && userId !== identity.id) {
      throw new AppError("No puedes crear una reserva para otro usuario", 403);
    }
    response.status(201).json(service.createReservation(identity.id, roomId, date));
  }));
  app.get("/api/reservations", authenticated, route((request, response) => {
    const userId = request.query.userId;
    const identity = getAuthIdentity(request);
    if (userId !== undefined && userId !== identity.id) {
      throw new AppError("No puedes consultar las reservas de otro usuario", 403);
    }
    response.json(service.listUserReservations(identity.id));
  }));
  app.get(
    "/api/reservations/:id",
    authenticated,
    reservationOwner(service),
    route((request, response) => {
      response.json(service.getReservation(request.params.id));
    }),
  );
  app.delete(
    "/api/reservations/:id",
    authenticated,
    reservationOwner(service),
    route((request, response) => {
      response.json(service.cancelReservation(request.params.id));
    }),
  );
  app.post(
    "/api/users/:userId/credits",
    authenticated,
    requireRole("ADMIN"),
    route((request, response) => {
      const userId = request.params.userId;
      if (!userId) {
        throw new AppError("Identificador de usuario inválido", 400);
      }
      const body = isRecord(request.body) ? request.body : {};
      if (Object.keys(body).some((key) => key !== "amount")) {
        throw new AppError("El cuerpo de la solicitud no es válido", 400);
      }
      response.json(service.addCredits(userId, body.amount));
    }),
  );

  app.get("/api-docs.json", (_request, response) => {
    response.json(openApiDocument);
  });
  app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(openApiDocument));

  const errorHandler: ErrorRequestHandler = (error: unknown, _request, response, next) => {
    void next;
    if (error instanceof AppError) {
      response.status(error.statusCode).json({ error: error.message });
      return;
    }
    if (isRecord(error) && error.status === 400) {
      response.status(400).json({ error: "El cuerpo JSON no es válido" });
      return;
    }
    response.status(500).json({ error: "Error interno del servidor" });
  };
  app.use(errorHandler);

  return app;
}
