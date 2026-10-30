export interface MenuItemFixture {
  itemId: string;
  name: string;
  category: "HOT" | "DRINK" | "SNACK";
  price: number;
  prepMinutesPerBatch: number;
  batchSize: number;
  stockQty: number;
  isAvailable: boolean;
}

export interface CounterFixture {
  counterId: string;
  name: string;
  isActive: boolean;
  supportedCategories: string[];
  status: "AVAILABLE" | "BUSY" | "PAUSED" | "CLOSED";
  speedFactor: number;
}

export interface OrderFixtureItem {
  itemId: string;
  quantity: number;
}

export interface OrderFixture {
  orderId: string;
  tokenNo: string;
  status: "QUEUED" | "ASSIGNED" | "PREPARING" | "READY" | "COMPLETED" | "CANCELLED";
  queueEnteredAt: string;
  items: OrderFixtureItem[];
}

export const menuItems: MenuItemFixture[] = [
  {
    itemId: "DOSA",
    name: "Dosa",
    category: "HOT",
    price: 40,
    prepMinutesPerBatch: 4,
    batchSize: 4,
    stockQty: 30,
    isAvailable: true,
  },
  {
    itemId: "TEA",
    name: "Tea",
    category: "DRINK",
    price: 15,
    prepMinutesPerBatch: 2,
    batchSize: 5,
    stockQty: 50,
    isAvailable: true,
  },
  {
    itemId: "SAND",
    name: "Sandwich",
    category: "SNACK",
    price: 50,
    prepMinutesPerBatch: 6,
    batchSize: 1,
    stockQty: 12,
    isAvailable: true,
  },
  {
    itemId: "PUFF",
    name: "Veg Puff",
    category: "SNACK",
    price: 20,
    prepMinutesPerBatch: 2,
    batchSize: 1,
    stockQty: 0,
    isAvailable: false,
  },
];

export const counters: CounterFixture[] = [
  {
    counterId: "C1",
    name: "Hot Food Counter",
    isActive: true,
    supportedCategories: ["HOT"],
    status: "AVAILABLE",
    speedFactor: 1,
  },
  {
    counterId: "C2",
    name: "Drinks & Snacks Counter",
    isActive: true,
    supportedCategories: ["DRINK", "SNACK"],
    status: "AVAILABLE",
    speedFactor: 1,
  },
];

const now = Date.now();
export const orders: OrderFixture[] = [
  {
    orderId: "O1001",
    tokenNo: "T001",
    status: "QUEUED",
    queueEnteredAt: new Date(now - 2 * 60000).toISOString(),
    items: [{ itemId: "DOSA", quantity: 2 }],
  },
  {
    orderId: "O1002",
    tokenNo: "T002",
    status: "QUEUED",
    queueEnteredAt: new Date(now - 1 * 60000).toISOString(),
    items: [{ itemId: "DOSA", quantity: 1 }],
  },
  {
    orderId: "O1003",
    tokenNo: "T003",
    status: "QUEUED",
    queueEnteredAt: new Date(now - 30000).toISOString(),
    items: [{ itemId: "TEA", quantity: 2 }],
  },
];
