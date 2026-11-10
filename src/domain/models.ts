export interface Room {
  id: string;
  name: string;
  hourlyRate: number;
}

export interface User {
  id: string;
  name: string;
  balance: number;
}

export type UserRole = "USER" | "EDITOR" | "ADMIN";

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  role: UserRole;
}

export type ReservationStatus = "CONFIRMED" | "CANCELLED";

export interface Reservation {
  id: string;
  userId: string;
  roomId: string;
  date: string;
  price: number;
  status: ReservationStatus;
}
