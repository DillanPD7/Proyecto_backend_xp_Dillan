import assert from "node:assert/strict";
import { After, Before, Given, Then, When, setWorldConstructor } from "@cucumber/cucumber";
import type { Express } from "express";
import request, { type Response } from "supertest";
import { createApp } from "../../src/app";
import { MemoryRepository } from "../../src/data/memory-repository";
import type { Reservation } from "../../src/domain/models";
import type { TestWorld } from "../support/world";

class CoworkingWorld implements TestWorld {
  repository = new MemoryRepository();
  app: Express = createApp(this.repository);
  response?: Response;
  reservationId?: string;
  pendingReservation?: TestWorld["pendingReservation"];
}

setWorldConstructor(CoworkingWorld);

Before(function (this: TestWorld) {
  this.repository = new MemoryRepository();
  this.app = createApp(this.repository);
  this.response = undefined;
  this.reservationId = undefined;
  this.pendingReservation = undefined;
});

After(function (this: TestWorld) {
  this.repository.reset();
});

function roomId(name: string): string {
  const id = name.toLowerCase().replace(" ", "-");
  return id;
}

function userId(name: string): string {
  return name.toLowerCase();
}

async function reserve(
  world: TestWorld,
  userName: string,
  roomName: string,
  date: string,
): Promise<Reservation | undefined> {
  world.response = await request(world.app)
    .post("/api/reservations")
    .send({ userId: userId(userName), roomId: roomId(roomName), date });
  if (world.response.status === 201) {
    return world.response.body as Reservation;
  }
  return undefined;
}

Given("que hay salas disponibles para {string}", async function (this: TestWorld, date: string) {
  this.response = await request(this.app).get("/api/rooms").query({ date });
});

Given(
  "que {string} tiene reservada la {string} para {string}",
  async function (this: TestWorld, user: string, room: string, date: string) {
    const reservation = await reserve(this, user, room, date);
    assert.ok(reservation, this.response?.body?.error);
    this.reservationId = reservation.id;
  },
);

Given("que {string} tiene saldo suficiente", function (this: TestWorld, user: string) {
  assert.ok(this.repository.getUser(userId(user))?.balance);
});

Given(
  "que {string} intenta reservar la {string} para {string}",
  function (this: TestWorld, user: string, room: string, date: string) {
    this.pendingReservation = { userId: user, roomId: room, date };
  },
);

When("consulto las salas para {string}", async function (this: TestWorld, date: string) {
  this.response = await request(this.app).get("/api/rooms").query({ date });
});

When(
  "{string} reserva la {string} para {string}",
  async function (this: TestWorld, user: string, room: string, date: string) {
    const reservation = await reserve(this, user, room, date);
    this.reservationId = reservation?.id;
  },
);

When(
  "{string} intenta reservar la {string} para {string}",
  async function (this: TestWorld, user: string, room: string, date: string) {
    await reserve(this, user, room, date);
  },
);

When("la solicitud de reserva se procesa", async function (this: TestWorld) {
  assert.ok(this.pendingReservation);
  await reserve(
    this,
    this.pendingReservation.userId,
    this.pendingReservation.roomId,
    this.pendingReservation.date,
  );
});

When("cancelo la reserva de {string}", async function (this: TestWorld, user: string) {
  const reservation = this.repository
    .listReservations()
    .find((item) => item.userId === userId(user) && item.status === "CONFIRMED");
  assert.ok(reservation);
  this.reservationId = reservation.id;
  this.response = await request(this.app).delete(`/api/reservations/${reservation.id}`);
});

When("cancelo la reserva {string}", async function (this: TestWorld, id: string) {
  this.response = await request(this.app).delete(`/api/reservations/${id}`);
});

When("{string} consulta sus reservas", async function (this: TestWorld, user: string) {
  this.response = await request(this.app).get("/api/reservations").query({ userId: userId(user) });
});

When("{string} agrega {float} de crédito", async function (this: TestWorld, user: string, amount: number) {
  this.response = await request(this.app)
    .post(`/api/users/${userId(user)}/credits`)
    .send({ amount });
});

When("consulto el detalle de la reserva de {string}", async function (this: TestWorld, user: string) {
  const reservation = this.repository
    .listReservations()
    .find((item) => item.userId === userId(user));
  assert.ok(reservation);
  this.reservationId = reservation.id;
  this.response = await request(this.app).get(`/api/reservations/${reservation.id}`);
});

When("consulto el detalle de la reserva {string}", async function (this: TestWorld, id: string) {
  this.response = await request(this.app).get(`/api/reservations/${id}`);
});

When("consulto la especificación OpenAPI", async function (this: TestWorld) {
  this.response = await request(this.app).get("/api-docs.json");
});

When("abro la interfaz Swagger", async function (this: TestWorld) {
  this.response = await request(this.app).get("/api-docs/");
});

Then(
  "la respuesta es {int} y contiene {string}",
  function (this: TestWorld, status: number, roomName: string) {
    assert.equal(this.response?.status, status);
    assert.ok((this.response?.body as Array<{ name: string }>).some((room) => room.name === roomName));
  },
);

Then(
  "la respuesta es {int} y no contiene {string}",
  function (this: TestWorld, status: number, roomName: string) {
    assert.equal(this.response?.status, status);
    assert.ok(!(this.response?.body as Array<{ name: string }>).some((room) => room.name === roomName));
  },
);

Then(
  "la reserva se confirma con estado {string}",
  function (this: TestWorld, status: string) {
    assert.equal(this.response?.status, 201);
    assert.equal(this.response?.body.status, status);
  },
);

Then("el saldo de {string} queda en {float}", function (this: TestWorld, user: string, balance: number) {
  const actualBalance = this.repository.getUser(userId(user))?.balance;
  assert.equal(actualBalance, balance);
});

Then(
  "la reserva responde con estado {int} y error {string}",
  function (this: TestWorld, status: number, message: string) {
    assert.equal(this.response?.status, status);
    assert.equal(this.response?.body.error, message);
  },
);

Then("la reserva queda con estado {string}", function (this: TestWorld, status: string) {
  assert.equal(this.response?.status, 200);
  assert.equal(this.response?.body.status, status);
});

Then(
  "la cancelación responde con estado {int} y error {string}",
  function (this: TestWorld, status: number, message: string) {
    assert.equal(this.response?.status, status);
    assert.equal(this.response?.body.error, message);
  },
);

Then(
  "la respuesta de reservas es {int} y contiene {int} elemento",
  function (this: TestWorld, status: number, count: number) {
    assert.equal(this.response?.status, status);
    assert.equal((this.response?.body as Reservation[]).length, count);
  },
);

Then(
  "la respuesta de reservas es {int} y error {string}",
  function (this: TestWorld, status: number, message: string) {
    assert.equal(this.response?.status, status);
    assert.equal(this.response?.body.error, message);
  },
);

Then(
  "la recarga responde con estado {int} y saldo {float}",
  function (this: TestWorld, status: number, balance: number) {
    assert.equal(this.response?.status, status);
    assert.equal(this.response?.body.balance, balance);
  },
);

Then(
  "la recarga responde con estado {int} y error {string}",
  function (this: TestWorld, status: number, message: string) {
    assert.equal(this.response?.status, status);
    assert.equal(this.response?.body.error, message);
  },
);

Then(
  "el detalle responde con estado {int} e incluye la fecha {string}",
  function (this: TestWorld, status: number, date: string) {
    assert.equal(this.response?.status, status);
    assert.equal(this.response?.body.date, date);
  },
);

Then(
  "el detalle responde con estado {int} y error {string}",
  function (this: TestWorld, status: number, message: string) {
    assert.equal(this.response?.status, status);
    assert.equal(this.response?.body.error, message);
  },
);

Then(
  "la documentación responde con estado {int} y contiene {string}",
  function (this: TestWorld, status: number, endpoint: string) {
    assert.equal(this.response?.status, status);
    assert.ok(JSON.stringify(this.response?.body).includes(endpoint));
  },
);

Then("la interfaz Swagger responde con estado {int}", function (this: TestWorld, status: number) {
  assert.equal(this.response?.status, status);
});
