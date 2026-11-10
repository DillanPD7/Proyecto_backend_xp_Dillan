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

En producción, configura `JWT_SECRET` con al menos 32 caracteres aleatorios. El servidor de producción no inicia sin este secreto. Configura `CORS_ORIGINS` con una lista separada por comas de orígenes permitidos, por ejemplo `https://app.example.com`. Si no se configura, no se permiten orígenes de navegador externos.

Para habilitar la administración de créditos, configura juntos `ADMIN_EMAIL` y `ADMIN_PASSWORD`; la contraseña debe tener al menos 12 caracteres. Se crea una cuenta ADMIN al iniciar. El registro público siempre crea cuentas USER y no acepta roles proporcionados por el cliente.

En producción, sirve la API sobre HTTPS. En desarrollo, si no defines `JWT_SECRET`, se genera una clave aleatoria al iniciar y los tokens anteriores dejan de ser válidos después de reiniciar.

## Pruebas y calidad

```bash
npm run test:e2e
npm run test:auth
npm run lint
npm run build
```

Los escenarios están en `features/` y sus definiciones de pasos TypeScript en `tests/step_definitions/`. Cada escenario crea un repositorio en memoria aislado y prepara a Juan (saldo 100), Ana (saldo 10), Sala A (25) y Sala B (10). En ejecución, cada cuenta pública recién registrada empieza con saldo 0.

## Swagger

- Interfaz interactiva: `http://localhost:3000/api-docs`
- Especificación OpenAPI: `http://localhost:3000/api-docs.json`

## Endpoints

| Método | Ruta | Descripción |
|---|---|---|
| `GET` | `/health` | Estado del servicio |
| `GET` | `/api/rooms?date=YYYY-MM-DD` | Salas disponibles |
| `POST` | `/api/auth/register` | Registrar una cuenta |
| `POST` | `/api/auth/login` | Iniciar sesión y obtener JWT |
| `POST` | `/api/auth/refresh` | Renovar tokens |
| `GET` | `/api/profile` | Consultar perfil autenticado |
| `POST` | `/api/reservations` | Crear reserva para el usuario autenticado |
| `GET` | `/api/reservations` | Listar reservas propias |
| `GET` | `/api/reservations/:id` | Consultar una reserva propia |
| `DELETE` | `/api/reservations/:id` | Cancelar reserva propia y reembolsar |
| `POST` | `/api/users/:userId/credits` | Recargar saldo (solo ADMIN) |

La persistencia es en memoria con fines educativos: se reinicia al reiniciar el proceso.

### Autenticación y autorización

- `POST /api/auth/register`: recibe `name`, `email` y `password` (mínimo 12 caracteres y máximo 72 bytes); guarda el hash bcrypt y asigna siempre el rol `USER`.
- `POST /api/auth/login`: devuelve un access token de 15 minutos y un refresh token de 7 días. El refresh token se rota y solo se puede usar una vez.
- `POST /api/auth/refresh`: recibe `{ "refreshToken": "..." }` y devuelve el nuevo par de tokens.
- `GET /api/profile`: devuelve el perfil asociado al access token.
- Las rutas de reservas requieren `Authorization: Bearer <accessToken>` y las reservas solo son visibles/modificables por su propietario o ADMIN.
- `POST /api/users/:userId/credits` requiere el rol ADMIN.
- Login está limitado a 5 solicitudes por IP cada 15 minutos. El servidor usa Helmet, limita JSON a 10 KB y rechaza campos no permitidos en credenciales.
- `npm run test:auth` verifica también el rechazo de un access token expirado.

Prueba local con cURL (PowerShell; `curl.exe` evita el alias de `curl`):

```powershell
curl.exe -X POST http://localhost:3000/api/auth/register `
  -H "Content-Type: application/json" `
  -d '{"name":"Ana","email":"ana@example.com","password":"ClaveSegura123!"}'

curl.exe -X POST http://localhost:3000/api/auth/login `
  -H "Content-Type: application/json" `
  -d '{"email":"ana@example.com","password":"ClaveSegura123!"}'

curl.exe http://localhost:3000/api/profile `
  -H "Authorization: Bearer <accessToken>"

curl.exe -X POST http://localhost:3000/api/auth/refresh `
  -H "Content-Type: application/json" `
  -d '{"refreshToken":"<refreshToken>"}'
```

## Decisiones XP

- **BDD primero:** los seis flujos funcionales tienen escenarios de éxito y error/límite en Gherkin; se agregan escenarios para verificar la documentación Swagger. Las pruebas ejercitan los endpoints, no solo métodos aislados.
- **Diseño simple:** Express, servicio de dominio y repositorio en memoria, separados en capas y con TypeScript `strict`.
- **Refactorización:** lógica de reglas centralizada en el servicio, persistencia encapsulada y manejo consistente de errores HTTP.
- **Integración continua:** GitHub Actions ejecuta ESLint, la compilación TypeScript y Cucumber en push y pull request.

## Backlog

Historias y criterios de aceptación: [PRODUCT_BACKLOG.md](./PRODUCT_BACKLOG.md).
