import { AppError } from "../domain/errors";
import type { Reservation, Room, User } from "../domain/models";
import { MemoryRepository } from "../data/memory-repository";

export class CoworkingService {
  constructor(private readonly repository: MemoryRepository) {}

  listAvailableRooms(date: string): Room[] {
    this.validateDate(date);
    const bookedRoomIds = new Set(
      this.repository
        .listReservations()
        .filter((reservation) => reservation.date === date && reservation.status === "CONFIRMED")
        .map((reservation) => reservation.roomId),
    );
    return this.repository.listRooms().filter((room) => !bookedRoomIds.has(room.id));
  }

  addCredits(userId: string, amount: unknown): User {
    const user = this.requireUser(userId);
    if (typeof amount !== "number" || !Number.isFinite(amount) || amount <= 0) {
      throw new AppError("El monto debe ser un número mayor que cero", 400);
    }
    user.balance = this.roundMoney(user.balance + amount);
    return user;
  }

  createReservation(userId: string, roomId: string, date: string): Reservation {
    const user = this.requireUser(userId);
    const room = this.repository.getRoom(roomId);
    if (!room) {
      throw new AppError("Sala no encontrada", 404);
    }
    this.validateDate(date);
    if (
      this.repository
        .listReservations()
        .some(
          (reservation) =>
            reservation.roomId === roomId &&
            reservation.date === date &&
            reservation.status === "CONFIRMED",
        )
    ) {
      throw new AppError("La sala no está disponible para esa fecha", 409);
    }
    if (user.balance < room.hourlyRate) {
      throw new AppError("Saldo insuficiente", 409);
    }

    user.balance = this.roundMoney(user.balance - room.hourlyRate);
    return this.repository.saveReservation({
      userId,
      roomId,
      date,
      price: room.hourlyRate,
      status: "CONFIRMED",
    });
  }

  listUserReservations(userId: string): Reservation[] {
    this.requireUser(userId);
    return this.repository
      .listReservations()
      .filter((reservation) => reservation.userId === userId);
  }

  getReservation(id: string): Reservation {
    const reservation = this.repository.getReservation(id);
    if (!reservation) {
      throw new AppError("Reserva no encontrada", 404);
    }
    return reservation;
  }

  cancelReservation(id: string): Reservation {
    const reservation = this.getReservation(id);
    if (reservation.status === "CANCELLED") {
      throw new AppError("La reserva ya está cancelada", 409);
    }
    const user = this.requireUser(reservation.userId);
    user.balance = this.roundMoney(user.balance + reservation.price);
    reservation.status = "CANCELLED";
    this.repository.updateReservation(reservation);
    return reservation;
  }

  getUser(userId: string): User {
    return this.requireUser(userId);
  }

  private requireUser(userId: string): User {
    const user = this.repository.getUser(userId);
    if (!user) {
      throw new AppError("Usuario no encontrado", 404);
    }
    return user;
  }

  private validateDate(date: string): void {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      throw new AppError("La fecha debe tener formato YYYY-MM-DD", 400);
    }
    const parsedDate = new Date(`${date}T00:00:00.000Z`);
    if (Number.isNaN(parsedDate.getTime()) || parsedDate.toISOString().slice(0, 10) !== date) {
      throw new AppError("La fecha indicada no es válida", 400);
    }
  }

  private roundMoney(amount: number): number {
    return Math.round((amount + Number.EPSILON) * 100) / 100;
  }
}
