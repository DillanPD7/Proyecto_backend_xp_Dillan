Feature: Recargar saldo
  Como administrador
  Quiero agregar crédito a una cuenta
  Para pagar mis reservas

  Scenario: Agregar crédito a la cuenta
    When el administrador agrega 50 de crédito a "Juan"
    Then la recarga responde con estado 200 y saldo 150

  Scenario: Rechazar una recarga con monto inválido
    When el administrador agrega -5 de crédito a "Juan"
    Then la recarga responde con estado 400 y error "El monto debe ser un número mayor que cero"
