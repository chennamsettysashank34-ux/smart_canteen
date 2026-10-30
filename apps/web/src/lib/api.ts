const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export interface MenuItem {
  itemId: string;
  name: string;
  category: "HOT" | "DRINK" | "SNACK";
  price: number;
  prepMinutesPerBatch: number;
  batchSize: number;
  stockQty: number;
  isAvailable: boolean;
  isDailySpecial?: boolean;
  dailySpecialTag?: string;
}

export interface Counter {
  counterId: string;
  name: string;
  isActive: boolean;
  supportedCategories: string[];
  status: "AVAILABLE" | "BUSY" | "PAUSED" | "CLOSED";
  speedFactor: number;
}

export interface OrderItem {
  orderItemId: string;
  orderId: string;
  itemId: string;
  name: string;
  quantity: number;
  unitPrice: number;
  itemPrepMinutes: number;
}

export interface Order {
  orderId: string;
  tokenNo: string;
  userId?: string | null;
  guestName?: string | null;
  status: "QUEUED" | "ASSIGNED" | "PREPARING" | "READY" | "COMPLETED" | "CANCELLED";
  queueEnteredAt: string;
  assignedCounterId?: string | null;
  serviceStartedAt?: string | null;
  readyAt?: string | null;
  completedAt?: string | null;
  cancelledAt?: string | null;
  cancelReason?: string | null;
  isDelayed?: boolean;
  delayReason?: string | null;
  estimatedPrepMinutes?: number | null;
  estimatedWaitMinutes?: number | null;
  totalAmount: number;
  items: OrderItem[];
  cashierStatus?: "PENDING" | "ACCEPTED" | "REJECTED";
  isCashierAccepted?: boolean;
  cashierAcceptedAt?: string | null;
  cashierNotes?: string | null;
  paymentMethod?: "CASH" | "UPI" | "COLLEGE_CARD";
}

export interface GroceryItem {
  groceryId: string;
  name: string;
  category: "BATTER" | "DAIRY" | "PRODUCE" | "BEVERAGE" | "BAKERY" | "STAPLES";
  currentQty: number;
  unit: "kg" | "litres" | "packets" | "cans";
  minThreshold: number;
  idealStock: number;
  lastRestockedAt: string;
  expiryDaysRemaining: number;
  supplier: string;
  costPerUnit: number;
  renewalUrgent?: boolean;
}

export interface CanteenScheduleStatus {
  isOpen: boolean;
  isAcceptingOrders: boolean;
  isClosingSoon: boolean;
  openingTime: string;
  closingTime: string;
  cutoffTime: string;
  currentTimeFormatted: string;
  minutesUntilClosing: number;
  minutesUntilCutoff: number;
  statusMessage: string;
  simulatedTimeStr?: string | null;
}

export interface LiveQueueState {
  generatedAt: string;
  crowd: {
    level: "LOW" | "MODERATE" | "HIGH" | "PEAK";
    estimatedWaitMinutes: number;
    score: number;
    isCongested: boolean;
    congestionMessage: string | null;
  };
  metrics: {
    windowMinutes: number;
    sampleCompletedOrders: number;
    averageWaitMinutes: number | null;
    maximumWaitMinutes: number | null;
    p90WaitMinutes: number | null;
    averageQueueToReadyMinutes: number | null;
    completedInWindow: number;
    currentQueueLength: number;
    preparingCount: number;
    counterUtilisation: Array<{
      counterId: string;
      name: string;
      busyMinutes: number;
      utilisationPercent: number;
    }>;
  };
  counterPlan: Array<{
    counterId: string;
    name: string;
    isActive: boolean;
    currentOrderId: string | null;
    predictedAvailableAt: string | null;
    workloadMinutesFromNow: number;
    forecastQueueCount: number;
    nextOrderId: string | null;
  }>;
  blockedOrders: Array<{ orderId: string; reason: string }>;
  waitingOrders: Array<
    Order & {
      queuePosition: number;
      blockedReason?: string;
    }
  >;
  activePreparingOrders: Array<
    Order & {
      estimatedReadyInMinutes: number;
    }
  >;
  readyOrders: Order[];
  completedOrders: Order[];
  summary: {
    waitingCount: number;
    preparingCount: number;
    blockedCount: number;
  };
  schedule?: CanteenScheduleStatus;
  pendingCashierOrdersCount?: number;
  groceryRenewalAlertsCount?: number;
}

export interface SimulationResult {
  sampleOrderCount: number;
  baseline: {
    strategy: string;
    averageWaitMinutes: number | null;
    maximumWaitMinutes: number | null;
    completedCount: number;
    orderThroughputPerHour: number | null;
    counterUtilisation?: Array<{ counterId: string; utilisationPercent: number }>;
  };
  improved: {
    strategy: string;
    averageWaitMinutes: number | null;
    maximumWaitMinutes: number | null;
    completedCount: number;
    orderThroughputPerHour: number | null;
    counterUtilisation?: Array<{ counterId: string; utilisationPercent: number }>;
  };
  comparison: {
    waitReductionMinutes: number;
    improvementPercent: number;
    interpretation: string;
  };
}

export async function fetchApi<T = unknown>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const primaryUrl = `${API_BASE_URL.replace(/\/$/, "")}/${endpoint.replace(/^\//, "")}`;

  const defaultHeaders: Record<string, string> = {
    "Content-Type": "application/json",
  };

  const reqOptions: RequestInit = {
    ...options,
    headers: {
      ...defaultHeaders,
      ...(options.headers as Record<string, string>),
    },
  };

  let response: Response;
  try {
    response = await fetch(primaryUrl, reqOptions);
  } catch (primaryErr) {
    // If localhost failed (e.g. Windows IPv6 ::1 vs IPv4 127.0.0.1 mismatch), fallback to 127.0.0.1
    if (primaryUrl.includes("localhost")) {
      const fallbackUrl = primaryUrl.replace("localhost", "127.0.0.1");
      try {
        response = await fetch(fallbackUrl, reqOptions);
      } catch {
        throw primaryErr;
      }
    } else {
      throw primaryErr;
    }
  }

  if (!response.ok) {
    let errorMessage = "Unknown error";
    try {
      const errorJson = await response.json();
      errorMessage = errorJson.error || errorJson.message || JSON.stringify(errorJson);
    } catch {
      errorMessage = await response.text().catch(() => "Unknown network error");
    }
    throw new Error(errorMessage);
  }

  return response.json();
}

export async function checkApiHealth() {
  return fetchApi<{ ok: boolean; service: string }>("health");
}

export async function getMenu() {
  return fetchApi<{ menu: MenuItem[]; categories: string[] }>("api/menu");
}

export async function updateMenuItem(
  itemId: string,
  updates: Partial<MenuItem>,
  staffRoleHeader: string = "STAFF"
) {
  return fetchApi<{ ok: boolean; menuItem: MenuItem }>(`api/menu/${itemId}`, {
    method: "PATCH",
    headers: { "x-user-role": staffRoleHeader },
    body: JSON.stringify(updates),
  });
}

export async function getCounters() {
  return fetchApi<{ counters: Counter[] }>("api/counters");
}

export async function updateCounter(
  counterId: string,
  updates: Partial<Counter>,
  staffRoleHeader: string = "STAFF"
) {
  return fetchApi<{ ok: boolean; counter: Counter }>(`api/counters/${counterId}`, {
    method: "PATCH",
    headers: { "x-user-role": staffRoleHeader },
    body: JSON.stringify(updates),
  });
}

export async function getOrders(userId?: string) {
  const query = userId ? `?userId=${encodeURIComponent(userId)}` : "";
  return fetchApi<{ orders: Order[] }>(`api/orders${query}`);
}

export async function getOrder(identifier: string) {
  return fetchApi<{
    order: Order;
    liveQueue: {
      queuePosition: number | null;
      estimatedWaitMinutes: number;
      assignedCounterId: string | null;
      crowdLevel: string;
      isCongested: boolean;
    };
  }>(`api/orders/${identifier}`);
}

export async function createOrder(payload: {
  userId?: string;
  guestName?: string;
  items: Array<{ itemId: string; quantity: number }>;
}) {
  return fetchApi<{
    ok: boolean;
    message: string;
    order: Order;
    estimatedWaitMinutes: number;
    assignedCounterId: string | null;
  }>("api/orders", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function transitionOrder(
  orderId: string,
  action: "start" | "ready" | "complete" | "delay",
  options: {
    counterId?: string;
    delayMinutes?: number;
    delayReason?: string;
  } = {},
  staffRoleHeader: string = "STAFF"
) {
  return fetchApi<{ ok: boolean; order: Order }>(`api/orders/${orderId}/transition`, {
    method: "POST",
    headers: { "x-user-role": staffRoleHeader },
    body: JSON.stringify({ action, ...options }),
  });
}

export async function cancelOrder(orderId: string, reason?: string) {
  return fetchApi<{ ok: boolean; message: string; order: Order }>(
    `api/orders/${orderId}/cancel`,
    {
      method: "POST",
      body: JSON.stringify({ reason }),
    }
  );
}

export async function getLiveQueue() {
  return fetchApi<LiveQueueState>("api/queue/live");
}

export async function runSimulation() {
  return fetchApi<SimulationResult>("api/queue/simulate", {
    method: "POST",
  });
}

export async function resetDemoState() {
  return fetchApi<{ ok: boolean; message: string }>("api/demo/reset", {
    method: "POST",
  });
}

export async function loadDemoScenario(scenarioId: "low" | "peak" | "counter_breakdown") {
  return fetchApi<{ ok: boolean; message: string; liveState: LiveQueueState }>(
    `api/demo/scenarios/${scenarioId}`,
    {
      method: "POST",
    }
  );
}

export async function loginUser(payload: {
  userId?: string;
  rollNo?: string;
  email?: string;
  role?: "STUDENT" | "STAFF" | "GUEST";
  name?: string;
}) {
  return fetchApi<{ ok: boolean; user: { userId: string; name: string; rollNo?: string; role: string; phone?: string; portalVerified?: boolean } }>(
    "api/auth/login",
    {
      method: "POST",
      body: JSON.stringify(payload),
    }
  );
}

// Student Login Verification via Mobile Number registered with official college portal
export async function loginWithPhone(payload: { phone: string; otp?: string }) {
  return fetchApi<{
    ok: boolean;
    verified: boolean;
    portalName: string;
    user: { userId: string; name: string; rollNo?: string; phone: string; portalVerified: boolean; role: string };
    message: string;
  }>("api/auth/phone-login", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

// Option to add new items in the canteen for the canteen staff
export async function createMenuItem(
  item: {
    name: string;
    category: "HOT" | "DRINK" | "SNACK";
    price: number;
    prepMinutesPerBatch?: number;
    batchSize?: number;
    stockQty?: number;
    isDailySpecial?: boolean;
    dailySpecialTag?: string;
  },
  staffRoleHeader: string = "STAFF"
) {
  return fetchApi<{ ok: boolean; menuItem: MenuItem }>("api/menu", {
    method: "POST",
    headers: { "x-user-role": staffRoleHeader },
    body: JSON.stringify(item),
  });
}

// Option for kitchen staff to toggle daily specials
export async function setDailySpecial(
  itemId: string,
  isDailySpecial: boolean,
  dailySpecialTag?: string,
  staffRoleHeader: string = "STAFF"
) {
  return fetchApi<{ ok: boolean; menuItem: MenuItem }>(`api/menu/${itemId}/special`, {
    method: "PATCH",
    headers: { "x-user-role": staffRoleHeader },
    body: JSON.stringify({ isDailySpecial, dailySpecialTag }),
  });
}

// Cashier Interface Endpoints
export async function getCashierOrders() {
  return fetchApi<{ pendingOrders: Order[]; count: number }>("api/cashier/orders");
}

export async function actionCashierOrder(
  orderId: string,
  action: "ACCEPT" | "REJECT",
  options: { paymentMethod?: "CASH" | "UPI" | "COLLEGE_CARD"; notes?: string } = {},
  staffRoleHeader: string = "STAFF"
) {
  return fetchApi<{ ok: boolean; message: string; order: Order }>(
    `api/cashier/orders/${orderId}/action`,
    {
      method: "POST",
      headers: { "x-user-role": staffRoleHeader },
      body: JSON.stringify({ action, ...options }),
    }
  );
}

// Logistics of Groceries & Food items
export async function getGroceries() {
  return fetchApi<{ groceries: GroceryItem[]; renewalAlerts: GroceryItem[]; renewalAlertsCount: number }>(
    "api/groceries"
  );
}

export async function restockGrocery(
  groceryId: string,
  addQty: number,
  staffRoleHeader: string = "STAFF"
) {
  return fetchApi<{ ok: boolean; grocery: GroceryItem }>("api/groceries/restock", {
    method: "POST",
    headers: { "x-user-role": staffRoleHeader },
    body: JSON.stringify({ groceryId, addQty }),
  });
}

export async function consumeGrocery(
  groceryId: string,
  consumeQty: number,
  staffRoleHeader: string = "STAFF"
) {
  return fetchApi<{ ok: boolean; grocery: GroceryItem }>("api/groceries/consume", {
    method: "POST",
    headers: { "x-user-role": staffRoleHeader },
    body: JSON.stringify({ groceryId, consumeQty }),
  });
}

export async function renewGrocery(groceryId: string, staffRoleHeader: string = "STAFF") {
  return fetchApi<{ ok: boolean; message: string; grocery: GroceryItem }>("api/groceries/renew", {
    method: "POST",
    headers: { "x-user-role": staffRoleHeader },
    body: JSON.stringify({ groceryId }),
  });
}

// Canteen Operating Schedule (Open 8:30 AM - Close 5:30 PM, Cutoff 5:10 PM)
export async function getCanteenSchedule() {
  return fetchApi<CanteenScheduleStatus>("api/canteen/schedule");
}

export async function simulateCanteenSchedule(params: {
  hour?: number;
  minute?: number;
  reset?: boolean;
  enforceSchedule?: boolean;
}) {
  return fetchApi<{ ok: boolean; schedule: CanteenScheduleStatus; enforceSchedule: boolean }>(
    "api/canteen/schedule/simulate",
    {
      method: "POST",
      body: JSON.stringify(params),
    }
  );
}
