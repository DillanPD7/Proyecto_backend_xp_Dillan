Feature: Consultar mis reservas
  Como usuario registrado
  Quiero ver mis reservas
  Para organizar mis jornadas de trabajo

  Scenario: Listar las reservas del usuario
    Given que "Juan" tiene reservada la "Sala A" para "2099-12-02"
    When "Juan" consulta sus reservas
    Then la respuesta de reservas es 200 y contiene 1 elemento

  Scenario: No permitir consultar las reservas de otro usuario
    Given que "Juan" tiene reservada la "Sala A" para "2099-12-04"
    When "Ana" consulta las reservas de "Juan"
    Then la respuesta de reservas es 403 y error "No puedes consultar las reservas de otro usuario"
