export const openApiDocument = {
  openapi: "3.0.3",
  info: {
    title: "Coworking XP API",
    version: "1.0.0",
    description: "API REST para consultar espacios y gestionar reservas de coworking.",
  },
  servers: [{ url: "/" }],
  tags: [
    { name: "Salas" },
    { name: "Reservas" },
    { name: "Usuarios" },
  ],
  paths: {
    "/health": {
      get: {
        summary: "Verificar disponibilidad del servicio",
        responses: { "200": { description: "Servicio disponible" } },
      },
    },
    "/api/rooms": {
      get: {
        tags: ["Salas"],
        summary: "Listar salas disponibles para una fecha",
        parameters: [
          {
            in: "query",
            name: "date",
            required: true,
            schema: { type: "string", format: "date" },
          },
        ],
        responses: {
          "200": { description: "Salas disponibles" },
          "400": { description: "Fecha inválida o ausente" },
        },
      },
    },
    "/api/reservations": {
      get: {
        tags: ["Reservas"],
        summary: "Listar las reservas de un usuario",
        parameters: [
          { in: "query", name: "userId", required: true, schema: { type: "string" } },
        ],
        responses: {
          "200": { description: "Reservas del usuario" },
          "404": { description: "Usuario no encontrado" },
        },
      },
      post: {
        tags: ["Reservas"],
        summary: "Crear una reserva",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["userId", "roomId", "date"],
                properties: {
                  userId: { type: "string", example: "juan" },
                  roomId: { type: "string", example: "sala-a" },
                  date: { type: "string", format: "date", example: "2099-10-15" },
                },
              },
            },
          },
        },
        responses: {
          "201": { description: "Reserva confirmada" },
          "400": { description: "Datos de entrada inválidos" },
          "404": { description: "Usuario o sala no encontrados" },
          "409": { description: "Sala ocupada o saldo insuficiente" },
        },
      },
    },
    "/api/reservations/{id}": {
      get: {
        tags: ["Reservas"],
        summary: "Consultar una reserva",
        parameters: [{ in: "path", name: "id", required: true, schema: { type: "string" } }],
        responses: {
          "200": { description: "Detalle de la reserva" },
          "404": { description: "Reserva no encontrada" },
        },
      },
      delete: {
        tags: ["Reservas"],
        summary: "Cancelar una reserva y reembolsar el saldo",
        parameters: [{ in: "path", name: "id", required: true, schema: { type: "string" } }],
        responses: {
          "200": { description: "Reserva cancelada" },
          "404": { description: "Reserva no encontrada" },
          "409": { description: "Reserva ya cancelada" },
        },
      },
    },
    "/api/users/{userId}/credits": {
      post: {
        tags: ["Usuarios"],
        summary: "Agregar crédito a un usuario",
        parameters: [{ in: "path", name: "userId", required: true, schema: { type: "string" } }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["amount"],
                properties: { amount: { type: "number", exclusiveMinimum: 0, example: 50 } },
              },
            },
          },
        },
        responses: {
          "200": { description: "Saldo actualizado" },
          "400": { description: "Monto inválido" },
          "404": { description: "Usuario no encontrado" },
        },
      },
    },
  },
};
