import { MenuItemFixture, CounterFixture, OrderFixture } from "../fixtures.js";

export const ORDER_STATUS: {
  QUEUED: "QUEUED";
  ASSIGNED: "ASSIGNED";
  PREPARING: "PREPARING";
  READY: "READY";
  COMPLETED: "COMPLETED";
  CANCELLED: "CANCELLED";
};

export function counterCanHandleOrder(
  counter: any,
  order: any,
  menuItems: any
): boolean;

export function estimateOrderPrepMinutes(
  order: any,
  menuItems: any,
  counter?: any
): number;

export function validateOrderItems(
  items: Array<{ itemId: string; quantity: number }>,
  menu: any
): { valid: boolean; errors?: string[]; totalAmount?: number; prepMinutes?: number };

export function createOrderDraft(params: {
  orderId: string;
  tokenNo: string;
  items: Array<{ itemId: string; quantity: number }>;
  menuItems: any;
  now?: Date;
}): any;

export function buildQueuePlan(params: {
  orders: any[];
  counters: any[];
  menuItems: any[];
  now?: Date;
  config?: any;
}): any;

export function calculateMetrics(params: {
  orders: any[];
  counters: any[];
  now?: Date;
  windowMinutes?: number;
}): any;

export function calculateCrowdLevel(params: {
  queuePlan: any;
}): { level: "LOW" | "MODERATE" | "HIGH" | "PEAK"; estimatedWaitMinutes: number; score: number };

export function startOrder(params: {
  order: any;
  counter: any;
  menuItems: any;
  now?: Date;
}): { ok: boolean; order?: any; error?: string };

export function transitionOrder(params: {
  order: any;
  nextStatus: string;
  now?: Date;
}): { ok: boolean; order?: any; error?: string };

export function simulateQueue(params: {
  arrivals: any[];
  counters: any[];
  menuItems: any[];
  strategy?: "EARLIEST_AVAILABLE" | "EARLIEST_FINISH";
  startAt?: Date;
}): any;
