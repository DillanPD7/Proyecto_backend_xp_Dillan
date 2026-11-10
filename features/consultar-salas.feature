Feature: Consultar disponibilidad de salas
  Como usuario registrado
  Quiero consultar las salas disponibles para una fecha
  Para elegir un espacio antes de reservarlo

  Scenario: Consultar salas disponibles
    Given que hay salas disponibles para "2099-10-15"
    When consulto las salas para "2099-10-15"
    Then la respuesta es 200 y contiene "Sala A"

  Scenario: Una sala reservada no aparece como disponible
    Given que "Juan" tiene reservada la "Sala A" para "2099-10-16"
    When consulto las salas para "2099-10-16"
    Then la respuesta es 200 y no contiene "Sala A"
