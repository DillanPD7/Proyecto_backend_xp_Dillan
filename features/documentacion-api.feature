Feature: Documentación interactiva de la API
  Como desarrollador
  Quiero explorar los endpoints en Swagger
  Para probar la API sin una herramienta adicional

  Scenario: Obtener el documento OpenAPI
    When consulto la especificación OpenAPI
    Then la documentación responde con estado 200 y contiene "/api/reservations"

  Scenario: Abrir la interfaz de Swagger
    When abro la interfaz Swagger
    Then la interfaz Swagger responde con estado 200
