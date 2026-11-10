Feature: Consultar detalle de reserva
  Como usuario registrado
  Quiero consultar el detalle de una reserva
  Para verificar el espacio y la fecha confirmados

  Scenario: Consultar una reserva existente
    Given que "Juan" tiene reservada la "Sala A" para "2099-12-03"
    When consulto el detalle de la reserva de "Juan"
    Then el detalle responde con estado 200 e incluye la fecha "2099-12-03"

  Scenario: Consultar una reserva inexistente
    When consulto el detalle de la reserva "inexistente"
    Then el detalle responde con estado 404 y error "Reserva no encontrada"
