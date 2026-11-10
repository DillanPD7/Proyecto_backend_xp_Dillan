import type { Reservation, Room, User } from "../domain/models";

export class MemoryRepository {
  private users = new Map<string, User>();
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
