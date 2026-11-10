# Plataforma de reservas de coworking — XP y BDD

API REST en TypeScript para consultar salas, administrar saldo y crear, cancelar y consultar reservas. Las pruebas de aceptación se escriben en Gherkin y se ejecutan contra la aplicación Express mediante Cucumber y Supertest.

## Requisitos

- Node.js 22 o superior
- npm

## Instalación y ejecución

```bash
npm install
npm run dev
```

La API queda disponible en `http://localhost:3000`. Para compilar y ejecutar la versión compilada:

```bash
npm run build
npm start
```

## Pruebas y calidad

```bash
npm run test:e2e
npm run lint
npm run build
```

Los escenarios están en `features/` y sus definiciones de pasos TypeScript en `tests/step_definitions/`. Cada escenario crea un repositorio en memoria aislado. Los datos iniciales incluyen a Juan (saldo 100), Ana (saldo 10), Sala A (25) y Sala B (10).

## Swagger

- Interfaz interactiva: `http://localhost:3000/api-docs`
- Especificación OpenAPI: `http://localhost:3000/api-docs.json`

## Endpoints

| Método | Ruta | Descripción |
|---|---|---|
| `GET` | `/health` | Estado del servicio |
| `GET` | `/api/rooms?date=YYYY-MM-DD` | Salas disponibles |
| `POST` | `/api/reservations` | Crear reserva (`userId`, `roomId`, `date`) |
| `GET` | `/api/reservations?userId=juan` | Reservas de un usuario |
| `GET` | `/api/reservations/:id` | Detalle de una reserva |
| `DELETE` | `/api/reservations/:id` | Cancelar y reembolsar |
| `POST` | `/api/users/:userId/credits` | Recargar saldo (`amount`) |

La persistencia es en memoria con fines educativos: se reinicia al reiniciar el proceso.

## Decisiones XP

- **BDD primero:** los seis flujos funcionales tienen escenarios de éxito y error/límite en Gherkin; se agregan escenarios para verificar la documentación Swagger. Las pruebas ejercitan los endpoints, no solo métodos aislados.
- **Diseño simple:** Express, servicio de dominio y repositorio en memoria, separados en capas y con TypeScript `strict`.
- **Refactorización:** lógica de reglas centralizada en el servicio, persistencia encapsulada y manejo consistente de errores HTTP.
- **Integración continua:** GitHub Actions ejecuta ESLint, la compilación TypeScript y Cucumber en push y pull request.

## Backlog

Historias y criterios de aceptación: [PRODUCT_BACKLOG.md](./PRODUCT_BACKLOG.md).
