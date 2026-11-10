import type { Express } from "express";
import type { Response } from "supertest";
import { MemoryRepository } from "../../src/data/memory-repository";

export interface TestWorld {
  repository: MemoryRepository;
  app: Express;
  response?: Response;
  reservationId?: string;
  authTokens: Map<string, string>;
  userIds: Map<string, string>;
  pendingReservation?: {
    userId: string;
    roomId: string;
    date: string;
  };
}
