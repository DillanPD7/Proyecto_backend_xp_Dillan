import express, { type ErrorRequestHandler, type RequestHandler } from "express";
import swaggerUi from "swagger-ui-express";
import { MemoryRepository } from "./data/memory-repository";
import { AppError } from "./domain/errors";
import { openApiDocument } from "./docs/openapi";
import { CoworkingService } from "./services/coworking-service";

function route(handler: RequestHandler): RequestHandler {
  return (request, response, next) => {
    try {
      handler(request, response, next);
    } catch (error) {
      next(error);
    }
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function createApp(repository = new MemoryRepository()): express.Express {
  const app = express();
  const service = new CoworkingService(repository);

  app.use(express.json());
  app.get("/health", (_request, response) => {
    response.json({ status: "ok" });
  });
  app.get("/api/rooms", route((request, response) => {
    const date = request.query.date;
    if (typeof date !== "string") {
      throw new AppError("El parámetro date es obligatorio", 400);
    }
    response.json(service.listAvailableRooms(date));
  }));
  app.post("/api/reservations", route((request, response) => {
    if (!isRecord(request.body)) {
      throw new AppError("userId, roomId y date son obligatorios", 400);
    }
    const { userId, roomId, date } = request.body;
    if (
      typeof userId !== "string" ||
      typeof roomId !== "string" ||
      typeof date !== "string"
    ) {
      throw new AppError("userId, roomId y date son obligatorios", 400);
    }
    response.status(201).json(service.createReservation(userId, roomId, date));
  }));
  app.get("/api/reservations", route((request, response) => {
    const userId = request.query.userId;
    if (typeof userId !== "string") {
      throw new AppError("El parámetro userId es obligatorio", 400);
    }
    response.json(service.listUserReservations(userId));
  }));
  app.get("/api/reservations/:id", route((request, response) => {
    const id = request.params.id;
    if (!id) {
      throw new AppError("Identificador de reserva inválido", 400);
    }
    response.json(service.getReservation(id));
  }));
  app.delete("/api/reservations/:id", route((request, response) => {
    const id = request.params.id;
    if (!id) {
      throw new AppError("Identificador de reserva inválido", 400);
    }
    response.json(service.cancelReservation(id));
  }));
  app.post("/api/users/:userId/credits", route((request, response) => {
    const userId = request.params.userId;
    if (!userId) {
      throw new AppError("Identificador de usuario inválido", 400);
    }
    const body = isRecord(request.body) ? request.body : {};
    response.json(service.addCredits(userId, body.amount));
  }));

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
    response.status(500).json({ error: "Error interno del servidor" });
  };
  app.use(errorHandler);

  return app;
}
