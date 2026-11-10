# Backlog del producto

## Historias funcionales

### HU-01 — Consultar disponibilidad
Como usuario registrado, quiero consultar las salas disponibles para una fecha para elegir un espacio antes de reservarlo.

- Para una fecha válida, se muestran las salas sin reservas confirmadas.
- Las salas con reserva confirmada para esa fecha no aparecen.
- Una fecha ausente o inválida produce una respuesta 400.

### HU-02 — Reservar una sala
Como usuario registrado, quiero reservar una sala disponible para asegurar un espacio de trabajo.

- Una reserva exitosa queda confirmada y descuenta el precio del saldo.
- No se permite reservar si el saldo es insuficiente.
- No se permite reservar una sala ocupada en esa fecha.

### HU-03 — Cancelar una reserva
Como usuario con una reserva confirmada, quiero cancelarla para liberar la sala y recuperar mi saldo.

- La cancelación cambia el estado a CANCELLED y reembolsa el costo.
- La sala queda disponible nuevamente para esa fecha.
- Una reserva inexistente responde 404 y una ya cancelada responde 409.

### HU-04 — Consultar mis reservas
Como usuario registrado, quiero ver mis reservas para organizar mis jornadas de trabajo.

- Se listan las reservas pertenecientes al usuario solicitado.
- Una lista vacía se devuelve como respuesta exitosa.
- Un usuario inexistente responde 404.

### HU-05 — Recargar saldo
Como usuario registrado, quiero agregar crédito a mi cuenta para pagar mis reservas.

- Una recarga positiva actualiza el saldo.
- Un monto cero, negativo o no numérico responde 400.
- Un usuario inexistente responde 404.

### HU-06 — Consultar detalle
Como usuario registrado, quiero consultar el detalle de una reserva para verificar el espacio y la fecha confirmados.

- Una reserva existente devuelve usuario, sala, fecha, precio y estado.
- Una reserva inexistente responde 404.

## Historias técnicas / requisitos no funcionales

### HT-01 — Validación y manejo seguro de errores
Como responsable de la API, quiero validar los datos de entrada y no exponer detalles internos para evitar errores de negocio y filtraciones de información.

- Las entradas inválidas se responden con HTTP 400 y un mensaje claro.
- Las entidades inexistentes se responden con HTTP 404; los conflictos con HTTP 409.
- Los errores internos no exponen stack traces ni detalles de implementación.

### HT-02 — Contrato de API explorable
Como desarrollador consumidor, quiero consultar y probar los endpoints en Swagger para integrar la API con rapidez.

- La interfaz interactiva está disponible en `/api-docs`.
- El documento OpenAPI está disponible en `/api-docs.json` e incluye las rutas REST.

### HT-03 — Verificación continua
Como equipo de desarrollo, quiero ejecutar lint, compilación y escenarios BDD en cada cambio para detectar regresiones.

- GitHub Actions ejecuta lint, `tsc` y Cucumber en cada push y pull request.
- El pipeline falla si una validación falla.
