import type { AuthUser, Reservation, Room, User } from "../domain/models";

export class MemoryRepository {
  private users = new Map<string, User>();
  private authUsers = new Map<string, AuthUser>();
  private userIdsByEmail = new Map<string, string>();
  private refreshTokens = new Map<string, { userId: string; expiresAt: number }>();
  private rooms = new Map<string, Room>();
  private reservations = new Map<string, Reservation>();
  private nextReservationId = 1;

  constructor() {
    this.reset();
  }

  reset(): void {
    this.users = new Map([
      ["juan", { id: "juan", name: "Juan", balance: 100 }],
      ["ana", { id: "ana", name: "Ana", balance: 10 }],
    ]);
    this.authUsers.clear();
    this.userIdsByEmail.clear();
    this.refreshTokens.clear();
    this.rooms = new Map([
      ["sala-a", { id: "sala-a", name: "Sala A", hourlyRate: 25 }],
      ["sala-b", { id: "sala-b", name: "Sala B", hourlyRate: 10 }],
    ]);
    this.reservations.clear();
    this.nextReservationId = 1;
  }

  getUser(id: string): User | undefined {
    return this.users.get(id);
  }

  getAuthUserByEmail(email: string): AuthUser | undefined {
    const userId = this.userIdsByEmail.get(email);
    return userId ? this.authUsers.get(userId) : undefined;
  }

  getAuthUserById(id: string): AuthUser | undefined {
    return this.authUsers.get(id);
  }

  saveAuthUser(user: AuthUser): boolean {
    if (this.userIdsByEmail.has(user.email)) {
      return false;
    }
    this.authUsers.set(user.id, user);
    this.userIdsByEmail.set(user.email, user.id);
    if (!this.users.has(user.id)) {
      this.users.set(user.id, { id: user.id, name: user.name, balance: 0 });
    }
    return true;
  }

  storeRefreshToken(jti: string, userId: string, expiresAt: number): void {
    this.refreshTokens.set(jti, { userId, expiresAt });
  }

  consumeRefreshToken(jti: string, now: number): string | undefined {
    const token = this.refreshTokens.get(jti);
    this.refreshTokens.delete(jti);
    return token && token.expiresAt > now ? token.userId : undefined;
  }

  getRoom(id: string): Room | undefined {
    return this.rooms.get(id);
  }

  listRooms(): Room[] {
    return [...this.rooms.values()];
  }

  listReservations(): Reservation[] {
    return [...this.reservations.values()];
  }

  getReservation(id: string): Reservation | undefined {
    return this.reservations.get(id);
  }

  saveReservation(
    reservation: Omit<Reservation, "id">,
  ): Reservation {
    const saved = { ...reservation, id: `reservation-${this.nextReservationId}` };
    this.nextReservationId += 1;
    this.reservations.set(saved.id, saved);
    return saved;
  }

  updateReservation(reservation: Reservation): void {
    this.reservations.set(reservation.id, reservation);
  }
}
