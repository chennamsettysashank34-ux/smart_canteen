export type OrderStatus =
  | "QUEUED"
  | "ASSIGNED"
  | "PREPARING"
  | "READY"
  | "COMPLETED"
  | "CANCELLED";

export type UserRole = "STUDENT" | "STAFF" | "MANAGER" | "ADMIN";

export interface MenuItem {
  id: string;
  name: string;
  category: string;
  price: number;
  prepMinutes: number;
  batchSize: number;
  stockQty: number;
  isAvailable: boolean;
}

export interface Counter {
  id: string;
  name: string;
  isActive: boolean;
  status: "OPEN" | "BUSY" | "PAUSED" | "CLOSED";
}

export interface ApiResponse<T = unknown> {
  ok: boolean;
  data?: T;
  error?: string;
}
