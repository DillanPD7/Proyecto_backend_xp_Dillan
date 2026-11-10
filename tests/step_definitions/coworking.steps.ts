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
  authTokens = new Map<string, string>();
  userIds = new Map<string, string>();
  pendingReservation?: TestWorld["pendingReservation"];
}

setWorldConstructor(CoworkingWorld);

const testPassword = "TestPassword123!";
const adminEmail = "admin@example.test";
const adminPassword = "AdminPassword123!";

Before(function (this: TestWorld) {
  this.repository = new MemoryRepository();
  this.app = createApp(this.repository, {
    jwtSecret: "test-secret-with-more-than-thirty-two-characters",
    adminEmail,
    adminPassword,
  });
  this.response = undefined;
  this.reservationId = undefined;
  this.authTokens = new Map();
  this.userIds = new Map();
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

async function authFor(world: TestWorld, name: string): Promise<string> {
  const key = userId(name);
  const cachedToken = world.authTokens.get(key);
  if (cachedToken) {
    return cachedToken;
  }
  const email = `${key}@example.test`;
  const registration = await request(world.app)
    .post("/api/auth/register")
    .send({ name, email, password: testPassword });
  assert.equal(registration.status, 201, registration.body.error);
  const id = registration.body.user.id as string;
  world.userIds.set(key, id);
  const startingBalance = key === "juan" ? 100 : key === "ana" ? 10 : 0;
  const account = world.repository.getUser(id);
  assert.ok(account);
  account.balance = startingBalance;
  const login = await request(world.app)
    .post("/api/auth/login")
    .send({ email, password: testPassword });
  assert.equal(login.status, 200, login.body.error);
  const token = login.body.accessToken as string;
  world.authTokens.set(key, token);
  return token;
}

async function adminToken(world: TestWorld): Promise<string> {
  const login = await request(world.app)
    .post("/api/auth/login")
    .send({ email: adminEmail, password: adminPassword });
  assert.equal(login.status, 200, login.body.error);
  return login.body.accessToken as string;
}

async function reserve(
  world: TestWorld,
  userName: string,
  roomName: string,
  date: string,
): Promise<Reservation | undefined> {
  const token = await authFor(world, userName);
  world.response = await request(world.app)
    .post("/api/reservations")
    .set("Authorization", `Bearer ${token}`)
    .send({ roomId: roomId(roomName), date });
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

Given("que {string} tiene saldo suficiente", async function (this: TestWorld, user: string) {
  let id = this.userIds.get(userId(user));
  if (!id) {
    await authFor(this, user);
    id = this.userIds.get(userId(user));
  }
  assert.ok(id && this.repository.getUser(id)?.balance);
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
  const token = await authFor(this, user);
  const ownerId = this.userIds.get(userId(user));
  const reservation = this.repository
    .listReservations()
    .find((item) => item.userId === ownerId && item.status === "CONFIRMED");
  assert.ok(reservation);
  this.reservationId = reservation.id;
  this.response = await request(this.app)
    .delete(`/api/reservations/${reservation.id}`)
    .set("Authorization", `Bearer ${token}`);
});

When("cancelo la reserva {string}", async function (this: TestWorld, id: string) {
  const token = await authFor(this, "Juan");
  this.response = await request(this.app)
    .delete(`/api/reservations/${id}`)
    .set("Authorization", `Bearer ${token}`);
});

When("{string} consulta sus reservas", async function (this: TestWorld, user: string) {
  const token = await authFor(this, user);
  this.response = await request(this.app)
    .get("/api/reservations")
    .set("Authorization", `Bearer ${token}`);
});

When("el administrador agrega {float} de crédito a {string}", async function (this: TestWorld, amount: number, user: string) {
  await authFor(this, user);
  const targetId = this.userIds.get(userId(user));
  assert.ok(targetId);
  const token = await adminToken(this);
  this.response = await request(this.app)
    .post(`/api/users/${targetId}/credits`)
    .set("Authorization", `Bearer ${token}`)
    .send({ amount });
});

When("consulto el detalle de la reserva de {string}", async function (this: TestWorld, user: string) {
  const token = await authFor(this, user);
  const ownerId = this.userIds.get(userId(user));
  const reservation = this.repository
    .listReservations()
    .find((item) => item.userId === ownerId);
  assert.ok(reservation);
  this.reservationId = reservation.id;
  this.response = await request(this.app)
    .get(`/api/reservations/${reservation.id}`)
    .set("Authorization", `Bearer ${token}`);
});

When("consulto el detalle de la reserva {string}", async function (this: TestWorld, id: string) {
  const token = await authFor(this, "Juan");
  this.response = await request(this.app)
    .get(`/api/reservations/${id}`)
    .set("Authorization", `Bearer ${token}`);
});

When("{string} consulta las reservas de {string}", async function (this: TestWorld, user: string, owner: string) {
  const token = await authFor(this, user);
  const ownerId = this.userIds.get(userId(owner));
  assert.ok(ownerId);
  this.response = await request(this.app)
    .get("/api/reservations")
    .query({ userId: ownerId })
    .set("Authorization", `Bearer ${token}`);
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
  const id = this.userIds.get(userId(user));
  const actualBalance = id ? this.repository.getUser(id)?.balance : undefined;
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
