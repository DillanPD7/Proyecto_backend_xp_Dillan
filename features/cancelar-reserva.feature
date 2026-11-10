Feature: Cancelar una reserva
  Como usuario con una reserva confirmada
  Quiero cancelarla
  Para liberar la sala y recuperar mi saldo

  Scenario: Cancelar una reserva y recuperar el saldo
    Given que "Juan" tiene reservada la "Sala A" para "2099-12-01"
    When cancelo la reserva de "Juan"
    Then la reserva queda con estado "CANCELLED"
    And el saldo de "Juan" queda en 100

  Scenario: No se puede cancelar una reserva inexistente
    When cancelo la reserva "inexistente"
    Then la cancelación responde con estado 404 y error "Reserva no encontrada"
