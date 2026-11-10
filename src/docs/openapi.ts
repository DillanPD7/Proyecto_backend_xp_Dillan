export const openApiDocument = {
  openapi: "3.0.3",
  info: {
    title: "Coworking XP API",
    version: "1.0.0",
    description: "API REST para consultar espacios y gestionar reservas con JWT y control de acceso por roles.",
  },
  servers: [{ url: "/" }],
  tags: [
    { name: "Salas" },
    { name: "Autenticación" },
    { name: "Reservas" },
    { name: "Usuarios" },
  ],
  paths: {
    "/api/auth/register": {
      post: {
        tags: ["Autenticación"],
        summary: "Registrar una cuenta con rol USER",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["name", "email", "password"],
                properties: {
                  name: { type: "string", example: "Ana" },
                  email: { type: "string", format: "email", example: "ana@example.com" },
                  password: { type: "string", minLength: 12, maxLength: 72 },
                },
              },
            },
          },
        },
        responses: {
          "201": { description: "Cuenta registrada; nunca se acepta un rol del cliente" },
          "400": { description: "Datos inválidos" },
          "409": { description: "Email ya registrado" },
        },
      },
    },
    "/api/auth/login": {
      post: {
        tags: ["Autenticación"],
        summary: "Iniciar sesión y obtener access y refresh tokens",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["email", "password"],
                properties: {
                  email: { type: "string", format: "email" },
                  password: { type: "string" },
                },
              },
            },
          },
        },
        responses: {
          "200": { description: "Tokens JWT; access token válido por 15 minutos" },
          "401": { description: "Credenciales inválidas" },
          "429": { description: "Límite de intentos alcanzado" },
        },
      },
    },
    "/api/auth/refresh": {
      post: {
        tags: ["Autenticación"],
        summary: "Rotar refresh token y emitir un nuevo par de tokens",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["refreshToken"],
                properties: { refreshToken: { type: "string" } },
              },
            },
          },
        },
        responses: {
          "200": { description: "Nuevo par de tokens" },
          "401": { description: "Refresh token inválido, expirado o ya utilizado" },
        },
      },
    },
    "/api/profile": {
      get: {
        tags: ["Autenticación"],
        summary: "Consultar el perfil autenticado",
        security: [{ bearerAuth: [] }],
        responses: { "200": { description: "Perfil sin credenciales" }, "401": { description: "Token requerido" } },
      },
    },
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
        security: [{ bearerAuth: [] }],
        responses: {
          "200": { description: "Reservas del usuario" },
          "401": { description: "Token requerido" },
          "403": { description: "No se permite consultar reservas ajenas" },
        },
      },
      post: {
        tags: ["Reservas"],
        summary: "Crear una reserva para el usuario autenticado",
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["roomId", "date"],
                properties: {
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
          "401": { description: "Token requerido" },
          "403": { description: "No se permite reservar para otra identidad" },
          "404": { description: "Usuario o sala no encontrados" },
          "409": { description: "Sala ocupada o saldo insuficiente" },
        },
      },
    },
    "/api/reservations/{id}": {
      get: {
        tags: ["Reservas"],
        summary: "Consultar una reserva",
        security: [{ bearerAuth: [] }],
        parameters: [{ in: "path", name: "id", required: true, schema: { type: "string" } }],
        responses: {
          "200": { description: "Detalle de la reserva" },
          "401": { description: "Token requerido" },
          "404": { description: "Reserva no encontrada" },
          "403": { description: "La reserva pertenece a otro usuario" },
        },
      },
      delete: {
        tags: ["Reservas"],
        summary: "Cancelar una reserva y reembolsar el saldo",
        security: [{ bearerAuth: [] }],
        parameters: [{ in: "path", name: "id", required: true, schema: { type: "string" } }],
        responses: {
          "200": { description: "Reserva cancelada" },
          "401": { description: "Token requerido" },
          "404": { description: "Reserva no encontrada" },
          "403": { description: "La reserva pertenece a otro usuario" },
          "409": { description: "Reserva ya cancelada" },
        },
      },
    },
    "/api/users/{userId}/credits": {
      post: {
        tags: ["Usuarios"],
        summary: "Agregar crédito a un usuario (solo ADMIN)",
        security: [{ bearerAuth: [] }],
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
          "401": { description: "Token requerido" },
          "403": { description: "Se requiere rol ADMIN" },
          "404": { description: "Usuario no encontrado" },
        },
      },
    },
  },
  components: {
    securitySchemes: {
      bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT" },
    },
  },
};
