Feature: Crear una reserva
  Como usuario registrado
  Quiero reservar una sala disponible
  Para asegurar un espacio de trabajo

  Scenario: Reservar una sala disponible con saldo suficiente
    Given que "Juan" tiene saldo suficiente
    When "Juan" reserva la "Sala A" para "2099-11-01"
    Then la reserva se confirma con estado "CONFIRMED"
    And el saldo de "Juan" queda en 75

  Scenario: No permitir una reserva con saldo insuficiente
    Given que "Ana" intenta reservar la "Sala A" para "2099-11-02"
    When la solicitud de reserva se procesa
    Then la reserva responde con estado 409 y error "Saldo insuficiente"

  Scenario: No permitir reservar una sala ocupada
    Given que "Juan" tiene reservada la "Sala A" para "2099-11-03"
    When "Ana" intenta reservar la "Sala A" para "2099-11-03"
    Then la reserva responde con estado 409 y error "La sala no está disponible para esa fecha"
