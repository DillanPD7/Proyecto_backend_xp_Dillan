Feature: Recargar saldo
  Como usuario registrado
  Quiero agregar crédito a mi cuenta
  Para pagar mis reservas

  Scenario: Agregar crédito a la cuenta
    When "Juan" agrega 50 de crédito
    Then la recarga responde con estado 200 y saldo 150

  Scenario: Rechazar una recarga con monto inválido
    When "Juan" agrega -5 de crédito
    Then la recarga responde con estado 400 y error "El monto debe ser un número mayor que cero"
