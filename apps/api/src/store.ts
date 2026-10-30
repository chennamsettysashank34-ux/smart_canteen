import {
  ORDER_STATUS,
  buildQueuePlan,
  calculateCrowdLevel,
  calculateMetrics,
  counterCanHandleOrder,
  estimateOrderPrepMinutes,
  simulateQueue,
  validateOrderItems,
} from "./engine/smartCanteenEngine.mjs";

export interface User {
  userId: string;
  rollNo?: string;
  name: string;
  email?: string;
  phone?: string;
  portalVerified?: boolean;
  collegePortalName?: string;
  role: "STUDENT" | "STAFF" | "GUEST" | "ADMIN";
}

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
  // Cashier Routing & Payment Verification
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

export interface QueueEvent {
  eventId: string;
  orderId: string;
  eventType: "QUEUED" | "ASSIGNED" | "PREPARING" | "READY" | "COMPLETED" | "CANCELLED" | "DELAYED";
  eventTime: string;
  counterId?: string | null;
  note?: string;
}

export interface InventoryEvent {
  inventoryEventId: string;
  itemId: string;
  changeQty: number;
  reason: string;
  eventTime: string;
  staffUserId?: string | null;
}

// Initial fixture data matching Section 7 of Hackathon document
const INITIAL_USERS: User[] = [
  {
    userId: "U101",
    rollNo: "1602-25-001",
    name: "Aarav Sharma",
    phone: "9876543210",
    email: "aarav.sharma@college.edu",
    portalVerified: true,
    collegePortalName: "CBIT Official Portal",
    role: "STUDENT",
  },
  {
    userId: "U102",
    rollNo: "1602-25-002",
    name: "Ananya Reddy",
    phone: "9876543211",
    email: "ananya.reddy@college.edu",
    portalVerified: true,
    collegePortalName: "CBIT Official Portal",
    role: "STUDENT",
  },
  {
    userId: "U103",
    name: "Demo Staff (Kitchen Lead)",
    email: "staff@canteen.edu",
    role: "STAFF",
  },
  {
    userId: "U104",
    name: "Guest Demo",
    role: "GUEST",
  },
];

const INITIAL_GROCERIES: GroceryItem[] = [
  {
    groceryId: "G01",
    name: "Dosa Batter (Fresh Fermented)",
    category: "BATTER",
    currentQty: 4, // Below 8kg threshold -> triggers renewal alert!
    unit: "kg",
    minThreshold: 8,
    idealStock: 25,
    lastRestockedAt: new Date(Date.now() - 24 * 3600000).toISOString(),
    expiryDaysRemaining: 1,
    supplier: "Campus Central Kitchen Prep Unit",
    costPerUnit: 45,
  },
  {
    groceryId: "G02",
    name: "Fresh Full-Cream Milk",
    category: "DAIRY",
    currentQty: 18,
    unit: "litres",
    minThreshold: 10,
    idealStock: 40,
    lastRestockedAt: new Date(Date.now() - 6 * 3600000).toISOString(),
    expiryDaysRemaining: 2,
    supplier: "Vijaya Dairy Cooperative",
    costPerUnit: 58,
  },
  {
    groceryId: "G03",
    name: "Sandwich Bread (Jumbo)",
    category: "BAKERY",
    currentQty: 5, // Below 10 packets threshold -> triggers renewal alert!
    unit: "packets",
    minThreshold: 10,
    idealStock: 30,
    lastRestockedAt: new Date(Date.now() - 36 * 3600000).toISOString(),
    expiryDaysRemaining: 2,
    supplier: "Modern Bakery Wholesalers",
    costPerUnit: 35,
  },
  {
    groceryId: "G04",
    name: "Premium Assam CTC Tea Powder",
    category: "BEVERAGE",
    currentQty: 7,
    unit: "kg",
    minThreshold: 3,
    idealStock: 15,
    lastRestockedAt: new Date(Date.now() - 48 * 3600000).toISOString(),
    expiryDaysRemaining: 60,
    supplier: "Tata Tea Agency",
    costPerUnit: 320,
  },
  {
    groceryId: "G05",
    name: "Refined Sunflower Cooking Oil",
    category: "STAPLES",
    currentQty: 7, // Below 12L threshold -> triggers renewal alert!
    unit: "litres",
    minThreshold: 12,
    idealStock: 40,
    lastRestockedAt: new Date(Date.now() - 72 * 3600000).toISOString(),
    expiryDaysRemaining: 90,
    supplier: "Freedom Oil Dist.",
    costPerUnit: 140,
  },
  {
    groceryId: "G06",
    name: "Potatoes & Onions (Veggies)",
    category: "PRODUCE",
    currentQty: 15,
    unit: "kg",
    minThreshold: 10,
    idealStock: 40,
    lastRestockedAt: new Date(Date.now() - 12 * 3600000).toISOString(),
    expiryDaysRemaining: 4,
    supplier: "Local Rythu Mandi",
    costPerUnit: 30,
  },
];

const INITIAL_MENU: MenuItem[] = [
  {
    itemId: "M01",
    name: "Dosa",
    category: "HOT",
    price: 40,
    prepMinutesPerBatch: 4,
    batchSize: 4,
    stockQty: 30,
    isAvailable: true,
    isDailySpecial: true,
    dailySpecialTag: "🔥 Chef's Special: Crispy Butter Dosa with Chutneys & Sambar",
  },
  {
    itemId: "M02",
    name: "Sandwich",
    category: "SNACK",
    price: 50,
    prepMinutesPerBatch: 6,
    batchSize: 1,
    stockQty: 12,
    isAvailable: true,
    isDailySpecial: false,
  },
  {
    itemId: "M03",
    name: "Tea",
    category: "DRINK",
    price: 15,
    prepMinutesPerBatch: 2,
    batchSize: 5,
    stockQty: 50,
    isAvailable: true,
    isDailySpecial: true,
    dailySpecialTag: "☕ Morning Special: Ginger Cardamom Masala Chai",
  },
  {
    itemId: "M04",
    name: "Veg Puff",
    category: "SNACK",
    price: 20,
    prepMinutesPerBatch: 2,
    batchSize: 1,
    stockQty: 0,
    isAvailable: false,
    isDailySpecial: false,
  },
];

const INITIAL_COUNTERS: Counter[] = [
  {
    counterId: "C01",
    name: "Take Away Counter 1 (Hot Express)",
    isActive: true,
    supportedCategories: ["HOT", "SNACK", "DRINK"],
    status: "AVAILABLE",
    speedFactor: 1,
  },
  {
    counterId: "C02",
    name: "Take Away Counter 2 (Snacks Express)",
    isActive: true,
    supportedCategories: ["SNACK", "DRINK"],
    status: "AVAILABLE",
    speedFactor: 1,
  },
  {
    counterId: "C03",
    name: "Take Away Counter 3 (Beverages & Chai)",
    isActive: true,
    supportedCategories: ["DRINK", "SNACK"],
    status: "AVAILABLE",
    speedFactor: 1,
  },
  {
    counterId: "C04",
    name: "Take Away Counter 4 (Express Parcel All-Items)",
    isActive: true,
    supportedCategories: ["HOT", "SNACK", "DRINK"],
    status: "AVAILABLE",
    speedFactor: 1,
  },
];

class CanteenStore {
  private users: User[] = [];
  private menu: MenuItem[] = [];
  private counters: Counter[] = [];
  private orders: Order[] = [];
  private groceries: GroceryItem[] = [];
  private queueEvents: QueueEvent[] = [];
  private inventoryEvents: InventoryEvent[] = [];
  private tokenSequence = 20;
  private orderSequence = 5000;
  private eventSequence = 0;
  private simulatedTime: { hour: number; minute: number } | null = null;
  public enforceSchedule: boolean = false;

  constructor() {
    this.reset();
  }

  public reset() {
    this.users = JSON.parse(JSON.stringify(INITIAL_USERS));
    this.menu = JSON.parse(JSON.stringify(INITIAL_MENU));
    this.counters = JSON.parse(JSON.stringify(INITIAL_COUNTERS));
    this.groceries = JSON.parse(JSON.stringify(INITIAL_GROCERIES));
    this.tokenSequence = 20;
    this.orderSequence = 5000;
    this.eventSequence = 0;
    this.simulatedTime = null;

    // Queue starts clean with zero random demo orders.
    // Only real orders placed by students or guests will appear in KDS.
    this.orders = [];
    this.queueEvents = [];
    this.inventoryEvents = [];
  }

  /**
   * Canteen Operating Schedule:
   * Open: 08:30 AM (8:30)
   * Close: 05:30 PM (17:30)
   * Order Cutoff: 20 minutes before closure = 05:10 PM (17:10)
   */
  public getCanteenSchedule(): CanteenScheduleStatus {
    let hour: number;
    let minute: number;

    if (this.simulatedTime) {
      hour = this.simulatedTime.hour;
      minute = this.simulatedTime.minute;
    } else {
      const now = new Date();
      hour = now.getHours();
      minute = now.getMinutes();
    }

    const currentMinutes = hour * 60 + minute;
    const openMinutes = 8 * 60 + 30; // 08:30 AM = 510
    const closeMinutes = 17 * 60 + 30; // 05:30 PM = 1050
    const cutoffMinutes = closeMinutes - 20; // 05:10 PM = 1030

    const isOpen = currentMinutes >= openMinutes && currentMinutes < closeMinutes;
    const isAcceptingOrders = currentMinutes >= openMinutes && currentMinutes < cutoffMinutes;
    const isClosingSoon = currentMinutes >= cutoffMinutes && currentMinutes < closeMinutes;

    const minutesUntilClosing = Math.max(0, closeMinutes - currentMinutes);
    const minutesUntilCutoff = Math.max(0, cutoffMinutes - currentMinutes);

    const pad = (n: number) => String(n).padStart(2, "0");
    const ampm = hour >= 12 ? "PM" : "AM";
    const displayHour = hour % 12 === 0 ? 12 : hour % 12;
    const currentTimeFormatted = `${pad(displayHour)}:${pad(minute)} ${ampm}`;

    let statusMessage = "Canteen is OPEN (8:30 AM – 5:30 PM). Kitchen accepting orders until 5:10 PM.";
    if (currentMinutes < openMinutes) {
      statusMessage = "Canteen is currently CLOSED. Opens at 08:30 AM.";
    } else if (isClosingSoon) {
      statusMessage = `⚠️ Canteen closes in ${minutesUntilClosing} minutes at 05:30 PM! Kitchen stopped accepting orders at 5:10 PM. Please pick up prepared food.`;
    } else if (currentMinutes >= closeMinutes) {
      statusMessage = "Canteen is CLOSED for the day. Operational hours are 8:30 AM to 5:30 PM.";
    }

    return {
      isOpen,
      isAcceptingOrders,
      isClosingSoon,
      openingTime: "08:30 AM",
      closingTime: "05:30 PM",
      cutoffTime: "05:10 PM",
      currentTimeFormatted,
      minutesUntilClosing,
      minutesUntilCutoff,
      statusMessage,
      simulatedTimeStr: this.simulatedTime
        ? `${pad(this.simulatedTime.hour)}:${pad(this.simulatedTime.minute)}`
        : null,
    };
  }

  public setSimulatedTime(hour: number | null, minute?: number | null): CanteenScheduleStatus {
    if (hour === null || hour === undefined) {
      this.simulatedTime = null;
    } else {
      this.simulatedTime = { hour, minute: minute ?? 0 };
    }
    return this.getCanteenSchedule();
  }

  /**
   * Restock menu items based on the current order history.
   * Called by the live queue endpoint to keep stock in sync.
   */
  public syncStockFromOrders(): void {
    // Stock is already deducted atomically on order creation and restored on cancel.
  }

  // User Management
  public getUsers(): User[] {
    return this.users;
  }

  public findUserById(userId: string): User | undefined {
    return this.users.find((u) => u.userId === userId);
  }

  public findUserByRollNo(rollNo: string): User | undefined {
    return this.users.find((u) => u.rollNo?.toLowerCase() === rollNo.toLowerCase());
  }

  public findUserByPhone(phone: string): User | undefined {
    const clean = phone.replace(/\D/g, "");
    return this.users.find((u) => {
      const uClean = u.phone ? u.phone.replace(/\D/g, "") : "";
      return uClean.length > 0 && (uClean === clean || uClean.endsWith(clean) || clean.endsWith(uClean));
    });
  }

  // Menu Management
  public getMenu(): MenuItem[] {
    return this.menu;
  }

  public getMenuItem(itemId: string): MenuItem | undefined {
    return this.menu.find((m) => m.itemId === itemId);
  }

  public updateMenuItem(
    itemId: string,
    updates: Partial<MenuItem>,
    staffUserId?: string
  ): MenuItem {
    const item = this.getMenuItem(itemId);
    if (!item) throw new Error(`Menu item ${itemId} not found.`);

    if (updates.name !== undefined) item.name = updates.name;
    if (updates.price !== undefined) item.price = Math.max(0, updates.price);
    if (updates.prepMinutesPerBatch !== undefined)
      item.prepMinutesPerBatch = Math.max(1, updates.prepMinutesPerBatch);
    if (updates.batchSize !== undefined)
      item.batchSize = Math.max(1, updates.batchSize);

    if (updates.stockQty !== undefined) {
      const oldStock = item.stockQty;
      const newStock = Math.max(0, updates.stockQty);
      const diff = newStock - oldStock;
      item.stockQty = newStock;
      item.isAvailable = newStock > 0;

      this.inventoryEvents.push({
        inventoryEventId: `IE${++this.eventSequence}`,
        itemId,
        changeQty: diff,
        reason: diff > 0 ? "RESTOCK" : "MANUAL_ADJUSTMENT",
        eventTime: new Date().toISOString(),
        staffUserId,
      });
    }

    if (updates.isAvailable !== undefined) {
      item.isAvailable = Boolean(updates.isAvailable);
    }

    if (updates.isDailySpecial !== undefined) {
      item.isDailySpecial = Boolean(updates.isDailySpecial);
    }
    if (updates.dailySpecialTag !== undefined) {
      item.dailySpecialTag = updates.dailySpecialTag;
    }

    return item;
  }

  public addMenuItem(params: {
    name: string;
    category: "HOT" | "DRINK" | "SNACK";
    price: number;
    prepMinutesPerBatch: number;
    batchSize: number;
    stockQty: number;
    isDailySpecial?: boolean;
    dailySpecialTag?: string;
  }): MenuItem {
    const nextNum = this.menu.length + 1;
    const itemId = `M${String(nextNum).padStart(2, "0")}`;

    const newItem: MenuItem = {
      itemId,
      name: params.name,
      category: params.category,
      price: Math.max(0, params.price),
      prepMinutesPerBatch: Math.max(1, params.prepMinutesPerBatch),
      batchSize: Math.max(1, params.batchSize),
      stockQty: Math.max(0, params.stockQty),
      isAvailable: params.stockQty > 0,
      isDailySpecial: Boolean(params.isDailySpecial),
      dailySpecialTag: params.dailySpecialTag || (params.isDailySpecial ? "Chef's Daily Special" : undefined),
    };

    this.menu.push(newItem);

    this.inventoryEvents.push({
      inventoryEventId: `IE${++this.eventSequence}`,
      itemId,
      changeQty: newItem.stockQty,
      reason: "NEW_ITEM_CREATED",
      eventTime: new Date().toISOString(),
    });

    return newItem;
  }

  public toggleDailySpecial(itemId: string, isDailySpecial: boolean, dailySpecialTag?: string): MenuItem {
    const item = this.getMenuItem(itemId);
    if (!item) throw new Error(`Item ${itemId} not found.`);
    item.isDailySpecial = isDailySpecial;
    if (dailySpecialTag) {
      item.dailySpecialTag = dailySpecialTag;
    } else if (!isDailySpecial) {
      item.dailySpecialTag = undefined;
    }
    return item;
  }

  // Logistics & Grocery Management
  public getGroceries(): GroceryItem[] {
    return this.groceries.map((g) => ({
      ...g,
      renewalUrgent: g.currentQty <= g.minThreshold || g.expiryDaysRemaining <= 1,
    }));
  }

  public getGroceryItem(groceryId: string): GroceryItem | undefined {
    return this.groceries.find((g) => g.groceryId === groceryId);
  }

  public restockGrocery(groceryId: string, addQty: number, staffUserId?: string): GroceryItem {
    const item = this.getGroceryItem(groceryId);
    if (!item) throw new Error(`Grocery item ${groceryId} not found.`);
    item.currentQty += Math.max(1, addQty);
    item.lastRestockedAt = new Date().toISOString();
    return item;
  }

  public consumeGrocery(groceryId: string, consumeQty: number): GroceryItem {
    const item = this.getGroceryItem(groceryId);
    if (!item) throw new Error(`Grocery item ${groceryId} not found.`);
    item.currentQty = Math.max(0, item.currentQty - consumeQty);
    return item;
  }

  public renewGrocery(groceryId: string, staffUserId?: string): GroceryItem {
    const item = this.getGroceryItem(groceryId);
    if (!item) throw new Error(`Grocery item ${groceryId} not found.`);
    item.currentQty = item.idealStock;
    item.lastRestockedAt = new Date().toISOString();
    item.expiryDaysRemaining =
      item.category === "BATTER" ? 2 : item.category === "DAIRY" ? 3 : item.category === "BAKERY" ? 4 : 60;
    return item;
  }

  // Cashier Acceptance Management
  public getCashierPendingOrders(): Order[] {
    return this.orders.filter((o) => o.cashierStatus === "PENDING" && o.status !== "CANCELLED");
  }

  public actionCashierOrder(
    orderId: string,
    action: "ACCEPT" | "REJECT",
    options: {
      paymentMethod?: "CASH" | "UPI" | "COLLEGE_CARD";
      notes?: string;
      staffUserId?: string;
    } = {}
  ): Order {
    const order = this.getOrder(orderId);
    if (!order) throw new Error(`Order ${orderId} not found.`);

    if (action === "ACCEPT") {
      order.cashierStatus = "ACCEPTED";
      order.isCashierAccepted = true;
      order.cashierAcceptedAt = new Date().toISOString();
      if (options.paymentMethod) order.paymentMethod = options.paymentMethod;
      order.cashierNotes = options.notes || `Payment accepted via ${order.paymentMethod || "Counter"}`;

      this.queueEvents.push({
        eventId: `E${++this.eventSequence}`,
        orderId,
        eventType: "QUEUED",
        eventTime: new Date().toISOString(),
        note: `Order payment verified by Cashier. Diverted to Kitchen Display.`,
      });

      return order;
    } else {
      const cancelled = this.cancelOrder(
        orderId,
        options.notes || "Rejected by Cashier at counter",
        options.staffUserId
      );
      cancelled.cashierStatus = "REJECTED";
      return cancelled;
    }
  }

  // Counter Management
  public getCounters(): Counter[] {
    return this.counters.map((c) => {
      const isBusy = this.orders.some(
        (o) => o.assignedCounterId === c.counterId && o.status === "PREPARING"
      );
      const effectiveStatus = !c.isActive
        ? (c.status === "CLOSED" ? "CLOSED" : "PAUSED")
        : (isBusy ? "BUSY" : (c.status === "PAUSED" ? "PAUSED" : "AVAILABLE"));
      c.status = effectiveStatus as any;
      return { ...c, status: effectiveStatus as any };
    });
  }

  public getCounter(counterId: string): Counter | undefined {
    const counter = this.counters.find((c) => c.counterId === counterId);
    if (!counter) return undefined;
    const isBusy = this.orders.some(
      (o) => o.assignedCounterId === counter.counterId && o.status === "PREPARING"
    );
    const effectiveStatus = !counter.isActive
      ? (counter.status === "CLOSED" ? "CLOSED" : "PAUSED")
      : (isBusy ? "BUSY" : (counter.status === "PAUSED" ? "PAUSED" : "AVAILABLE"));
    counter.status = effectiveStatus as any;
    return counter;
  }

  public updateCounter(counterId: string, updates: Partial<Counter>): Counter {
    const counter = this.getCounter(counterId);
    if (!counter) throw new Error(`Counter ${counterId} not found.`);

    if (updates.name !== undefined) counter.name = updates.name;
    if (updates.isActive !== undefined) counter.isActive = updates.isActive;
    if (updates.status !== undefined) counter.status = updates.status;
    if (updates.speedFactor !== undefined) counter.speedFactor = updates.speedFactor;
    if (updates.supportedCategories !== undefined)
      counter.supportedCategories = updates.supportedCategories;

    return counter;
  }

  // Orders Management
  public getOrders(): Order[] {
    return this.orders;
  }

  public getOrder(identifier: string): Order | undefined {
    return this.orders.find(
      (o) => o.orderId === identifier || o.tokenNo.toUpperCase() === identifier.toUpperCase()
    );
  }

  public getOrdersForUser(userId: string): Order[] {
    return this.orders.filter((o) => o.userId === userId);
  }

  /**
   * Create order with stock reservation, token generation, and queue plan integration.
   */
  public createOrder(params: {
    userId?: string;
    guestName?: string;
    items: Array<{ itemId: string; quantity: number }>;
    paymentMethod?: "CASH" | "UPI" | "COLLEGE_CARD";
  }): { order: Order; estimatedWaitMinutes: number; assignedCounterId: string | null } {
    if (!params.items || params.items.length === 0) {
      throw new Error("Order must contain at least one item.");
    }

    // Operating hours check (Stops accepting orders 20 minutes before closure at 5:10 PM)
    if (this.enforceSchedule && process.env.NODE_ENV !== "test") {
      const schedule = this.getCanteenSchedule();
      if (!schedule.isAcceptingOrders) {
        throw new Error(
          "Canteen is currently not accepting new orders. Kitchen order cutoff is 5:10 PM (20 minutes before 5:30 PM closing)."
        );
      }
    }

    // Server-side validation
    const validation = validateOrderItems(params.items, this.menu);
    if (!validation.valid) {
      throw new Error(`Order validation failed: ${(validation.errors || []).join(", ")}`);
    }

    // Concurrency / Stock recheck
    for (const line of params.items) {
      const menuItem = this.getMenuItem(line.itemId);
      if (!menuItem) {
        throw new Error(`Item ${line.itemId} is no longer available.`);
      }
      if (!menuItem.isAvailable || menuItem.stockQty < line.quantity) {
        throw new Error(
          `Insufficient stock for "${menuItem.name}". Available: ${menuItem.stockQty}, requested: ${line.quantity}.`
        );
      }
    }

    // Deduct stock atomically
    const orderItemsRecord: OrderItem[] = [];
    let totalAmount = 0;
    const now = new Date();
    const orderId = `O${++this.orderSequence}`;
    const tokenNo = `T${String(++this.tokenSequence).padStart(3, "0")}`;

    for (let i = 0; i < params.items.length; i++) {
      const line = params.items[i];
      const menuItem = this.getMenuItem(line.itemId)!;
      menuItem.stockQty -= line.quantity;
      if (menuItem.stockQty <= 0) {
        menuItem.isAvailable = false;
      }

      this.inventoryEvents.push({
        inventoryEventId: `IE${++this.eventSequence}`,
        itemId: menuItem.itemId,
        changeQty: -line.quantity,
        reason: `ORDER_RESERVED_${orderId}`,
        eventTime: now.toISOString(),
      });

      const lineTotal = line.quantity * menuItem.price;
      totalAmount += lineTotal;

      orderItemsRecord.push({
        orderItemId: `OI_${orderId}_${i + 1}`,
        orderId,
        itemId: menuItem.itemId,
        name: menuItem.name,
        quantity: line.quantity,
        unitPrice: menuItem.price,
        itemPrepMinutes: menuItem.prepMinutesPerBatch,
      });
    }

    const newOrder: Order = {
      orderId,
      tokenNo,
      userId: params.userId || null,
      guestName: params.guestName || (params.userId ? null : "Campus Guest"),
      status: "QUEUED",
      queueEnteredAt: now.toISOString(),
      assignedCounterId: null,
      totalAmount,
      items: orderItemsRecord,
      cashierStatus: "PENDING",
      isCashierAccepted: false,
      paymentMethod: params.paymentMethod || "UPI",
    };

    this.orders.push(newOrder);

    this.queueEvents.push({
      eventId: `E${++this.eventSequence}`,
      orderId,
      eventType: "QUEUED",
      eventTime: now.toISOString(),
      note: `Order ${tokenNo} placed. Diverted to Cashier for payment acceptance.`,
    });

    // Run Queue Planner to compute estimated wait and assigned counter
    const plan = buildQueuePlan({
      orders: this.orders,
      counters: this.counters,
      menuItems: this.menu,
      now,
    });

    const scheduled = plan.schedule[orderId];
    const estimatedWaitMinutes = scheduled?.estimatedWaitMinutesFromNow ?? 5;
    const assignedCounterId = scheduled?.counterId ?? null;

    newOrder.estimatedWaitMinutes = estimatedWaitMinutes;
    newOrder.assignedCounterId = assignedCounterId;

    return {
      order: newOrder,
      estimatedWaitMinutes,
      assignedCounterId,
    };
  }

  /**
   * Transition order status (QUEUED -> PREPARING -> READY -> COMPLETED)
   */
  public transitionOrderStatus(
    orderId: string,
    action: "start" | "ready" | "complete" | "delay",
    options: {
      counterId?: string;
      staffUserId?: string;
      delayMinutes?: number;
      delayReason?: string;
    } = {}
  ): Order {
    const order = this.getOrder(orderId);
    if (!order) throw new Error(`Order ${orderId} not found.`);
    const now = new Date();

    if (action === "start") {
      if (order.status !== "QUEUED" && order.status !== "ASSIGNED") {
        throw new Error(`Cannot start order in status ${order.status}`);
      }

      // Check counter eligibility: pick requested, scheduled, or first capable active counter
      let targetCounterId = options.counterId || order.assignedCounterId;
      if (!targetCounterId) {
        const capableCounter = this.counters.find(
          (c) => c.isActive && counterCanHandleOrder(c, order, this.menu)
        );
        targetCounterId = capableCounter ? capableCounter.counterId : this.counters[0].counterId;
      }
      const counter = this.getCounter(targetCounterId);
      if (!counter) throw new Error(`Counter ${targetCounterId} not found.`);
      if (!counter.isActive) throw new Error(`Counter ${counter.name} is currently inactive.`);

      const canHandle = counterCanHandleOrder(counter, order, this.menu);
      if (!canHandle) {
        throw new Error(
          `Counter "${counter.name}" cannot handle the item categories in order ${order.tokenNo}.`
        );
      }

      const prepMinutes = estimateOrderPrepMinutes(order, this.menu, counter) || 2;

      order.status = "PREPARING";
      order.assignedCounterId = counter.counterId;
      order.serviceStartedAt = now.toISOString();
      order.estimatedPrepMinutes = prepMinutes;
      counter.status = "BUSY";

      this.queueEvents.push({
        eventId: `E${++this.eventSequence}`,
        orderId: order.orderId,
        eventType: "PREPARING",
        eventTime: now.toISOString(),
        counterId: counter.counterId,
        note: `Order started by staff. Estimated prep: ${prepMinutes} mins.`,
      });
    } else if (action === "ready") {
      if (order.status !== "PREPARING") {
        throw new Error(`Cannot mark ready for order in status ${order.status}`);
      }

      order.status = "READY";
      order.readyAt = now.toISOString();

      // Free up counter if no other order is preparing at this counter
      if (order.assignedCounterId) {
        const otherPreparing = this.orders.some(
          (o) =>
            o.orderId !== order.orderId &&
            o.assignedCounterId === order.assignedCounterId &&
            o.status === "PREPARING"
        );
        if (!otherPreparing) {
          const counter = this.getCounter(order.assignedCounterId);
          if (counter) counter.status = "AVAILABLE";
        }
      }

      this.queueEvents.push({
        eventId: `E${++this.eventSequence}`,
        orderId: order.orderId,
        eventType: "READY",
        eventTime: now.toISOString(),
        counterId: order.assignedCounterId,
        note: `Order is ready for pickup at ${order.assignedCounterId}`,
      });
    } else if (action === "complete") {
      if (order.status !== "READY" && order.status !== "PREPARING") {
        throw new Error(`Cannot complete order in status ${order.status}`);
      }

      order.status = "COMPLETED";
      order.completedAt = now.toISOString();
      if (!order.serviceStartedAt) {
        order.serviceStartedAt = order.readyAt || now.toISOString();
      }

      if (order.assignedCounterId) {
        const otherPreparing = this.orders.some(
          (o) =>
            o.orderId !== order.orderId &&
            o.assignedCounterId === order.assignedCounterId &&
            o.status === "PREPARING"
        );
        if (!otherPreparing) {
          const counter = this.getCounter(order.assignedCounterId);
          if (counter) counter.status = "AVAILABLE";
        }
      }

      this.queueEvents.push({
        eventId: `E${++this.eventSequence}`,
        orderId: order.orderId,
        eventType: "COMPLETED",
        eventTime: now.toISOString(),
        counterId: order.assignedCounterId,
        note: `Order collected by customer. Lifecycle finished.`,
      });
    } else if (action === "delay") {
      const extra = options.delayMinutes || 3;
      order.isDelayed = true;
      order.delayReason = options.delayReason || `Kitchen rush / preparation extended (+${extra}m)`;
      const startMs = order.serviceStartedAt ? new Date(order.serviceStartedAt).getTime() : now.getTime();
      const elapsedMinutes = (now.getTime() - startMs) / 60000;
      const currentPrep = order.estimatedPrepMinutes || 2;
      // If prep has already elapsed past current estimate, ensure new finish time is at least 'extra' minutes from now
      order.estimatedPrepMinutes = Math.max(currentPrep + extra, Math.ceil(elapsedMinutes) + extra);

      this.queueEvents.push({
        eventId: `E${++this.eventSequence}`,
        orderId: order.orderId,
        eventType: "DELAYED",
        eventTime: now.toISOString(),
        counterId: order.assignedCounterId,
        note: `Order delayed +${extra} min: ${order.delayReason}`,
      });
    }

    return order;
  }

  /**
   * Cancel order and release stock reservation
   */
  public cancelOrder(
    orderId: string,
    reason: string = "Customer requested cancellation",
    staffUserId?: string
  ): Order {
    const order = this.getOrder(orderId);
    if (!order) throw new Error(`Order ${orderId} not found.`);

    if (order.status === "COMPLETED" || order.status === "CANCELLED") {
      throw new Error(`Cannot cancel an order with status "${order.status}".`);
    }

    order.status = "CANCELLED";
    order.cancelledAt = new Date().toISOString();
    order.cancelReason = reason;

    // Release reserved inventory
    for (const item of order.items) {
      const menuItem = this.getMenuItem(item.itemId);
      if (menuItem) {
        menuItem.stockQty += item.quantity;
        if (menuItem.stockQty > 0) menuItem.isAvailable = true;

        this.inventoryEvents.push({
          inventoryEventId: `IE${++this.eventSequence}`,
          itemId: item.itemId,
          changeQty: item.quantity,
          reason: `CANCEL_RELEASE_${order.orderId}`,
          eventTime: new Date().toISOString(),
          staffUserId,
        });
      }
    }

    // If counter was occupied, release it
    if (order.assignedCounterId) {
      const counter = this.getCounter(order.assignedCounterId);
      if (counter) {
        const otherPreparing = this.orders.some(
          (o) =>
            o.orderId !== order.orderId &&
            o.assignedCounterId === order.assignedCounterId &&
            o.status === "PREPARING"
        );
        if (!otherPreparing) counter.status = "AVAILABLE";
      }
    }

    this.queueEvents.push({
      eventId: `E${++this.eventSequence}`,
      orderId: order.orderId,
      eventType: "CANCELLED",
      eventTime: new Date().toISOString(),
      counterId: order.assignedCounterId,
      note: `Order cancelled. Reason: ${reason}. Stock returned to inventory.`,
    });

    return order;
  }

  /**
   * Get live queue snapshot, metrics, and crowd alert
   */
  public getLiveQueueState() {
    const now = new Date();
    const plan = buildQueuePlan({
      orders: this.orders,
      counters: this.counters,
      menuItems: this.menu,
      now,
    });
    const crowd = calculateCrowdLevel({ queuePlan: plan });
    const metrics = calculateMetrics({
      orders: this.orders,
      counters: this.counters,
      now,
      windowMinutes: 60,
    });

    const waitingOrders = this.orders
      .filter((o) => o.status === "QUEUED" || o.status === "ASSIGNED")
      .map((o, idx) => {
        const scheduled = plan.schedule[o.orderId];
        return {
          ...o,
          queuePosition: idx + 1,
          assignedCounterId: scheduled?.counterId || o.assignedCounterId,
          estimatedWaitMinutes: scheduled?.estimatedWaitMinutesFromNow ?? o.estimatedWaitMinutes ?? 0,
          blockedReason: scheduled?.blockedReason,
        };
      });

    const activePreparingOrders = this.orders
      .filter((o) => o.status === "PREPARING")
      .map((o) => {
        const scheduled = plan.schedule[o.orderId];
        return {
          ...o,
          estimatedReadyInMinutes: scheduled?.estimatedReadyInMinutes ?? 2,
        };
      });

    const readyOrders = this.orders.filter((o) => o.status === "READY");
    const completedOrders = this.orders.filter((o) => o.status === "COMPLETED");

    const isCongested = crowd.level === "HIGH" || crowd.level === "PEAK";

    const pendingCashierOrders = this.getCashierPendingOrders();
    const urgentGroceries = this.getGroceries().filter((g) => g.renewalUrgent);

    return {
      generatedAt: now.toISOString(),
      crowd: {
        ...crowd,
        isCongested,
        congestionMessage: isCongested
          ? `High kitchen congestion (${waitingOrders.length} orders queued). Expect additional preparation latency.`
          : null,
      },
      metrics,
      counterPlan: plan.counterPlan,
      blockedOrders: plan.blockedOrders,
      waitingOrders,
      activePreparingOrders,
      readyOrders,
      completedOrders,
      summary: plan.summary,
      schedule: this.getCanteenSchedule(),
      pendingCashierOrdersCount: pendingCashierOrders.length,
      groceryRenewalAlertsCount: urgentGroceries.length,
    };
  }

  /**
   * Pre-configured hackathon demo scenarios
   */
  public loadScenario(scenarioId: "low" | "peak" | "counter_breakdown") {
    this.reset();
    const baseTime = Date.now();

    if (scenarioId === "low") {
      // 1 order preparing, 1 queued - use demo-prefixed IDs to never collide with real orders
      this.orders = [
        {
          orderId: "DEMO-01",
          tokenNo: "T021",
          userId: "U101",
          status: "PREPARING",
          cashierStatus: "ACCEPTED",
          isCashierAccepted: true,
          queueEnteredAt: new Date(baseTime - 3 * 60000).toISOString(),
          serviceStartedAt: new Date(baseTime - 2 * 60000).toISOString(),
          assignedCounterId: "C01",
          estimatedPrepMinutes: 4,
          totalAmount: 40,
          items: [
            {
              orderItemId: "OI1",
              orderId: "DEMO-01",
              itemId: "M01",
              name: "Dosa",
              quantity: 1,
              unitPrice: 40,
              itemPrepMinutes: 4,
            },
          ],
        },
        {
          orderId: "DEMO-02",
          tokenNo: "T022",
          userId: "U102",
          status: "QUEUED",
          cashierStatus: "ACCEPTED",
          isCashierAccepted: true,
          queueEnteredAt: new Date(baseTime - 1 * 60000).toISOString(),
          assignedCounterId: "C02",
          estimatedWaitMinutes: 2,
          totalAmount: 15,
          items: [
            {
              orderItemId: "OI2",
              orderId: "DEMO-02",
              itemId: "M03",
              name: "Tea",
              quantity: 1,
              unitPrice: 15,
              itemPrepMinutes: 2,
            },
          ],
        },
      ];
    } else if (scenarioId === "peak") {
      // Sudden rush of 10 incoming orders across multiple categories
      const peakOrders: Order[] = [];
      const itemPool = ["M01", "M02", "M03"];
      for (let i = 1; i <= 10; i++) {
        const itemChoice = itemPool[i % 3];
        const m = this.getMenuItem(itemChoice)!;
        const qty = (i % 2) + 1;
        peakOrders.push({
          orderId: `DEMO-P${i}`,
          tokenNo: `T0${30 + i}`,
          guestName: `Rush Customer #${i}`,
          status: i === 1 ? "PREPARING" : "QUEUED",
          cashierStatus: "ACCEPTED",
          isCashierAccepted: true,
          queueEnteredAt: new Date(baseTime - (12 - i) * 30000).toISOString(),
          serviceStartedAt: i === 1 ? new Date(baseTime - 60000).toISOString() : null,
          assignedCounterId: i === 1 ? "C01" : null,
          estimatedPrepMinutes: m.prepMinutesPerBatch,
          totalAmount: m.price * qty,
          items: [
            {
              orderItemId: `OI_P_${i}`,
              orderId: `DEMO-P${i}`,
              itemId: m.itemId,
              name: m.name,
              quantity: qty,
              unitPrice: m.price,
              itemPrepMinutes: m.prepMinutesPerBatch,
            },
          ],
        });
      }
      this.orders = peakOrders;
    } else if (scenarioId === "counter_breakdown") {
      // Hot food capable counters C01 and C04 are set inactive/closed
      const c1 = this.getCounter("C01");
      if (c1) {
        c1.isActive = false;
        c1.status = "CLOSED";
      }
      const c4 = this.getCounter("C04");
      if (c4) {
        c4.isActive = false;
        c4.status = "CLOSED";
      }
      this.orders = [
        {
          orderId: "DEMO-CB1",
          tokenNo: "T021",
          userId: "U101",
          status: "QUEUED",
          cashierStatus: "ACCEPTED",
          isCashierAccepted: true,
          queueEnteredAt: new Date(baseTime - 2 * 60000).toISOString(),
          totalAmount: 40,
          items: [
            {
              orderItemId: "OI1",
              orderId: "DEMO-CB1",
              itemId: "M01",
              name: "Dosa",
              quantity: 1,
              unitPrice: 40,
              itemPrepMinutes: 4,
            },
          ],
        },
        {
          orderId: "DEMO-CB2",
          tokenNo: "T022",
          userId: "U102",
          status: "QUEUED",
          cashierStatus: "ACCEPTED",
          isCashierAccepted: true,
          queueEnteredAt: new Date(baseTime - 1 * 60000).toISOString(),
          totalAmount: 15,
          items: [
            {
              orderItemId: "OI2",
              orderId: "DEMO-CB2",
              itemId: "M03",
              name: "Tea",
              quantity: 1,
              unitPrice: 15,
              itemPrepMinutes: 2,
            },
          ],
        },
      ];
    } // end loadScenario

    // Bump sequences so real orders placed after a scenario never collide with demo IDs
    this.orderSequence = Math.max(
      this.orderSequence,
      ...this.orders.map((o) => {
        const n = parseInt(o.orderId.replace(/\D/g, ""), 10);
        return isNaN(n) ? 0 : n;
      }),
      5100 // ensure real orders start well above scenario IDs
    );
    this.tokenSequence = Math.max(
      this.tokenSequence,
      ...this.orders.map((o) => {
        const n = parseInt(o.tokenNo.replace(/\D/g, ""), 10);
        return isNaN(n) ? 0 : n;
      }),
      50
    );
  }

  /**
   * Run comparison benchmark between Baseline FCFS vs Improved Strategy on identical arrivals
   */
  public runComparisonSimulation() {
    const arrivals = this.orders.map((o) => ({
      orderId: o.orderId,
      tokenNo: o.tokenNo,
      status: "QUEUED" as const,
      queueEnteredAt: o.queueEnteredAt,
      items: o.items.map((it) => ({ itemId: it.itemId, quantity: it.quantity })),
    }));

    // If active orders count is small, generate a balanced synthetic test batch of 12 orders for clear comparison
    const comparisonArrivals =
      arrivals.length >= 5
        ? arrivals
        : [
            { orderId: "SIM-01", tokenNo: "T101", status: "QUEUED" as const, queueEnteredAt: new Date(Date.now() - 10 * 60000).toISOString(), items: [{ itemId: "M01", quantity: 4 }] },
            { orderId: "SIM-02", tokenNo: "T102", status: "QUEUED" as const, queueEnteredAt: new Date(Date.now() - 9 * 60000).toISOString(), items: [{ itemId: "M03", quantity: 2 }] },
            { orderId: "SIM-03", tokenNo: "T103", status: "QUEUED" as const, queueEnteredAt: new Date(Date.now() - 8 * 60000).toISOString(), items: [{ itemId: "M02", quantity: 1 }] },
            { orderId: "SIM-04", tokenNo: "T104", status: "QUEUED" as const, queueEnteredAt: new Date(Date.now() - 7 * 60000).toISOString(), items: [{ itemId: "M01", quantity: 2 }] },
            { orderId: "SIM-05", tokenNo: "T105", status: "QUEUED" as const, queueEnteredAt: new Date(Date.now() - 6 * 60000).toISOString(), items: [{ itemId: "M03", quantity: 5 }] },
            { orderId: "SIM-06", tokenNo: "T106", status: "QUEUED" as const, queueEnteredAt: new Date(Date.now() - 5 * 60000).toISOString(), items: [{ itemId: "M02", quantity: 2 }] },
            { orderId: "SIM-07", tokenNo: "T107", status: "QUEUED" as const, queueEnteredAt: new Date(Date.now() - 4 * 60000).toISOString(), items: [{ itemId: "M01", quantity: 3 }] },
            { orderId: "SIM-08", tokenNo: "T108", status: "QUEUED" as const, queueEnteredAt: new Date(Date.now() - 3 * 60000).toISOString(), items: [{ itemId: "M03", quantity: 1 }] },
          ];

    const activeCounters = this.counters.filter((c) => c.isActive);
    const startAt = new Date();

    const baseline = simulateQueue({
      arrivals: comparisonArrivals,
      counters: activeCounters,
      menuItems: this.menu,
      strategy: "EARLIEST_AVAILABLE",
      startAt,
    });

    const improved = simulateQueue({
      arrivals: comparisonArrivals,
      counters: activeCounters,
      menuItems: this.menu,
      strategy: "EARLIEST_FINISH",
      startAt,
    });

    // Compute measurable differences
    const baselineAvg = baseline.averageWaitMinutes ?? 0;
    const improvedAvg = improved.averageWaitMinutes ?? 0;
    const waitDeltaMinutes = Math.round((baselineAvg - improvedAvg) * 100) / 100;
    const improvementPercent =
      baselineAvg > 0
        ? Math.round(((baselineAvg - improvedAvg) / baselineAvg) * 100)
        : 0;

    const fallbackMetrics = (sim: any, counters: Counter[]) => {
      const rows = (sim.results || []).filter((r: any) => !r.blocked);
      if (rows.length === 0) {
        return {
          orderThroughputPerHour: 0,
          counterUtilisation: counters.map((c) => ({
            counterId: c.counterId,
            utilisationPercent: 0,
          })),
        };
      }
      const startTimes = rows.map((r: any) => new Date(r.serviceStartAt).getTime());
      const finishTimes = rows.map((r: any) => new Date(r.readyAt).getTime());
      const earliest = Math.min(...startTimes);
      const latest = Math.max(...finishTimes);
      const spanMinutes = Math.max(1, (latest - earliest) / 60000);
      const orderThroughputPerHour = Math.round((rows.length / spanMinutes) * 60 * 10) / 10;
      const counterUtilisation = counters.map((c) => {
        const counterRows = rows.filter((r: any) => r.counterId === c.counterId);
        const busyMinutes = counterRows.reduce((sum: number, r: any) => sum + (r.prepMinutes || 0), 0);
        const utilisationPercent = Math.min(100, Math.round((busyMinutes / spanMinutes) * 100));
        return {
          counterId: c.counterId,
          utilisationPercent,
        };
      });
      return { orderThroughputPerHour, counterUtilisation };
    };

    const baselineMetrics = (baseline.counterUtilisation && baseline.orderThroughputPerHour !== undefined)
      ? baseline
      : fallbackMetrics(baseline, activeCounters);

    const improvedMetrics = (improved.counterUtilisation && improved.orderThroughputPerHour !== undefined)
      ? improved
      : fallbackMetrics(improved, activeCounters);

    return {
      sampleOrderCount: comparisonArrivals.length,
      baseline: {
        strategy: "Baseline FCFS (First Available)",
        averageWaitMinutes: baseline.averageWaitMinutes,
        maximumWaitMinutes: baseline.maximumWaitMinutes,
        completedCount: baseline.completedCount,
        orderThroughputPerHour: baselineMetrics.orderThroughputPerHour ?? 0,
        counterUtilisation: baselineMetrics.counterUtilisation ?? [],
      },
      improved: {
        strategy: "Smart Batch & Capability-Aware (Earliest Finish)",
        averageWaitMinutes: improved.averageWaitMinutes,
        maximumWaitMinutes: improved.maximumWaitMinutes,
        completedCount: improved.completedCount,
        orderThroughputPerHour: improvedMetrics.orderThroughputPerHour ?? 0,
        counterUtilisation: improvedMetrics.counterUtilisation ?? [],
      },
      comparison: {
        waitReductionMinutes: waitDeltaMinutes,
        improvementPercent,
        interpretation:
          improvementPercent > 0
            ? `Measured ${improvementPercent}% average waiting time reduction over identical arrival workloads.`
            : "Both strategies perform equally for this traffic profile.",
      },
    };
  }

  public getAuditEvents() {
    return {
      queueEvents: this.queueEvents.slice(-50).reverse(),
      inventoryEvents: this.inventoryEvents.slice(-50).reverse(),
    };
  }
}

export const store = new CanteenStore();


