Feature: Consultar mis reservas
  Como usuario registrado
  Quiero ver mis reservas
  Para organizar mis jornadas de trabajo

  Scenario: Listar las reservas del usuario
    Given que "Juan" tiene reservada la "Sala A" para "2099-12-02"
    When "Juan" consulta sus reservas
    Then la respuesta de reservas es 200 y contiene 1 elemento

  Scenario: Consultar las reservas de un usuario inexistente
    When "fantasma" consulta sus reservas
    Then la respuesta de reservas es 404 y error "Usuario no encontrado"
