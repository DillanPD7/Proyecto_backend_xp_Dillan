import assert from "node:assert/strict";
import { test } from "node:test";
import jwt from "jsonwebtoken";
import request from "supertest";
import { createApp } from "../src/app";
import { MemoryRepository } from "../src/data/memory-repository";
import type { Express } from "express";

const JWT_SECRET = "auth-integration-test-secret-with-at-least-32-characters";
const ADMIN_EMAIL = "admin@example.test";
const ADMIN_PASSWORD = "AdminPassword123!";
const PASSWORD = "StrongPassword123!";

function setup(): { app: Express; repository: MemoryRepository } {
  const repository = new MemoryRepository();
  const app = createApp(repository, {
    jwtSecret: JWT_SECRET,
    corsOrigins: ["https://frontend.example"],
    adminEmail: ADMIN_EMAIL,
    adminPassword: ADMIN_PASSWORD,
  });
  return { app, repository };
}

async function createAccount(app: Express, email: string): Promise<{ id: string; token: string }> {
  const registration = await request(app)
    .post("/api/auth/register")
    .send({ name: "Test User", email, password: PASSWORD });
  assert.equal(registration.status, 201);
  assert.equal(registration.body.user.role, "USER");
  assert.equal("passwordHash" in registration.body.user, false);

  const login = await request(app)
    .post("/api/auth/login")
    .send({ email, password: PASSWORD });
  assert.equal(login.status, 200);
  return { id: registration.body.user.id as string, token: login.body.accessToken as string };
}

test("registration validates input, hashes passwords and prevents public role escalation", async () => {
  const { app, repository } = setup();
  const escalated = await request(app)
    .post("/api/auth/register")
    .send({ name: "User", email: "user@example.test", password: PASSWORD, role: "ADMIN" });
  assert.equal(escalated.status, 400);
  assert.equal(repository.getAuthUserByEmail("user@example.test"), undefined);

  const created = await request(app)
    .post("/api/auth/register")
    .send({ name: "User", email: "user@example.test", password: PASSWORD });
  assert.equal(created.status, 201);
  const stored = repository.getAuthUserByEmail("user@example.test");
  assert.ok(stored);
  assert.notEqual(stored.passwordHash, PASSWORD);
  assert.equal(stored.role, "USER");
  assert.equal((await request(app)
    .post("/api/auth/register")
    .send({ name: "User", email: "USER@example.test", password: PASSWORD })).status, 409);
});

test("login issues short-lived access tokens and refresh rotates and revokes refresh tokens", async () => {
  const { app } = setup();
  const account = await createAccount(app, "refresh@example.test");
  const login = await request(app)
    .post("/api/auth/login")
    .send({ email: "refresh@example.test", password: "wrong-password" });
  assert.equal(login.status, 401);

  const firstLogin = await request(app)
    .post("/api/auth/login")
    .send({ email: "refresh@example.test", password: PASSWORD });
  assert.equal(firstLogin.body.expiresIn, 900);
  const originalRefresh = firstLogin.body.refreshToken as string;
  const refreshed = await request(app)
    .post("/api/auth/refresh")
    .send({ refreshToken: originalRefresh });
  assert.equal(refreshed.status, 200);
  assert.notEqual(refreshed.body.refreshToken, originalRefresh);
  assert.equal((await request(app)
    .post("/api/auth/refresh")
    .send({ refreshToken: originalRefresh })).status, 401);

  const profile = await request(app)
    .get("/api/profile")
    .set("Authorization", `Bearer ${refreshed.body.accessToken}`);
  assert.equal(profile.status, 200);
  assert.equal(profile.body.id, account.id);
  assert.equal(profile.body.email, "refresh@example.test");
  const expiredAccess = jwt.sign(
    { type: "access", role: "USER" },
    JWT_SECRET,
    { subject: account.id, expiresIn: -1, algorithm: "HS256" },
  );
  assert.equal((await request(app)
    .get("/api/profile")
    .set("Authorization", `Bearer ${expiredAccess}`)).status, 401);
});

test("reservation endpoints require authentication and enforce ownership against IDOR", async () => {
  const { app, repository } = setup();
  const owner = await createAccount(app, "owner@example.test");
  const other = await createAccount(app, "other@example.test");
  const ownerRecord = repository.getUser(owner.id);
  assert.ok(ownerRecord);
  ownerRecord.balance = 100;

  assert.equal((await request(app).get("/api/reservations")).status, 401);
  const created = await request(app)
    .post("/api/reservations")
    .set("Authorization", `Bearer ${owner.token}`)
    .send({ userId: other.id, roomId: "sala-a", date: "2099-12-10" });
  assert.equal(created.status, 403);

  const reservationResponse = await request(app)
    .post("/api/reservations")
    .set("Authorization", `Bearer ${owner.token}`)
    .send({ roomId: "sala-a", date: "2099-12-10" });
  assert.equal(reservationResponse.status, 201);
  const reservationId = reservationResponse.body.id as string;

  assert.equal((await request(app)
    .get(`/api/reservations/${reservationId}`)
    .set("Authorization", `Bearer ${other.token}`)).status, 403);
  assert.equal((await request(app)
    .delete(`/api/reservations/${reservationId}`)
    .set("Authorization", `Bearer ${other.token}`)).status, 403);
  assert.equal((await request(app)
    .get("/api/reservations")
    .query({ userId: owner.id })
    .set("Authorization", `Bearer ${other.token}`)).status, 403);
});

test("only an administrator can add credits and the login endpoint is rate limited", async () => {
  const { app } = setup();
  const account = await createAccount(app, "credits@example.test");
  const userAttempt = await request(app)
    .post(`/api/users/${account.id}/credits`)
    .set("Authorization", `Bearer ${account.token}`)
    .send({ amount: 25 });
  assert.equal(userAttempt.status, 403);

  const adminLogin = await request(app)
    .post("/api/auth/login")
    .send({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD });
  assert.equal(adminLogin.status, 200);
  const addedCredit = await request(app)
    .post(`/api/users/${account.id}/credits`)
    .set("Authorization", `Bearer ${adminLogin.body.accessToken}`)
    .send({ amount: 25 });
  assert.equal(addedCredit.status, 200);
  assert.equal(addedCredit.body.balance, 25);

  const limitedApp = setup().app;
  for (let attempt = 1; attempt <= 5; attempt += 1) {
    assert.equal((await request(limitedApp)
      .post("/api/auth/login")
      .send({ email: "missing@example.test", password: PASSWORD })).status, 401);
  }
  const blocked = await request(limitedApp)
    .post("/api/auth/login")
    .send({ email: "missing@example.test", password: PASSWORD });
  assert.equal(blocked.status, 429);
});

test("CORS accepts only configured origins and validation rejects nested or extra input", async () => {
  const { app } = setup();
  const allowed = await request(app)
    .get("/health")
    .set("Origin", "https://frontend.example");
  assert.equal(allowed.headers["access-control-allow-origin"], "https://frontend.example");

  const denied = await request(app)
    .get("/health")
    .set("Origin", "https://attacker.example");
  assert.equal(denied.status, 403);

  const injection = await request(app)
    .post("/api/auth/register")
    .send({ name: "User", email: { $ne: null }, password: PASSWORD });
  assert.equal(injection.status, 400);
});
