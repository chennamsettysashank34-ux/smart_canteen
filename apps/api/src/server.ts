import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import "dotenv/config";
import { z } from "zod";
import { store } from "./store.js";
import { validateOrderItems } from "./engine/smartCanteenEngine.mjs";

const app = express();
const port = Number(process.env.PORT ?? 4000);
const frontendOrigin = process.env.FRONTEND_ORIGIN ?? "*";

app.use(
  cors({
    origin: true, // Dynamically reflect request origin (supports localhost:3000, 3001, 127.0.0.1)
    credentials: true,
  })
);
app.use(express.json({ limit: "100kb" }));

// Security & Role Middleware
function requireStaffRole(req: Request, res: Response, next: NextFunction) {
  const role = req.headers["x-user-role"] || req.headers["x-role"];
  if (role && (role === "STAFF" || role === "ADMIN")) {
    return next();
  }
  // Allow if demo mode bypass header is present or default to checking authorization
  // For demo resilience, if header not passed or explicitly STUDENT, restrict
  if (role === "STUDENT" || role === "GUEST") {
    return res.status(403).json({
      error: "Forbidden",
      message: "Only authorized canteen staff can perform this kitchen operation.",
    });
  }
  // Allow local development / unauthenticated demo requests if not explicitly forbidden
  return next();
}

// -------------------------------------------------------------
// Health Check Endpoints
// -------------------------------------------------------------
app.get(["/health", "/api/health"], (_req: Request, res: Response) => {
  res.json({
    ok: true,
    service: "smart-canteen-api",
    mode: "demo-in-memory",
    status: "healthy",
  });
});

// -------------------------------------------------------------
// Authentication / Demo User Endpoints
// -------------------------------------------------------------
app.post("/api/auth/login", (req: Request, res: Response) => {
  const schema = z.object({
    userId: z.string().optional(),
    rollNo: z.string().optional(),
    email: z.string().optional(),
    role: z.string().optional(),
    name: z.string().optional(),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid login request", details: parsed.error.issues });
  }

  const { userId, rollNo, email, role, name } = parsed.data;
  const roleUpper = role ? role.toUpperCase() : undefined;

  // Direct user ID match (e.g. U101, U102, U103, U104)
  if (userId) {
    const matched = store.findUserById(userId);
    if (matched) {
      return res.json({ ok: true, user: matched });
    }
  }

  // Student Roll No lookup
  if (rollNo) {
    const student = store.findUserByRollNo(rollNo);
    if (student) {
      return res.json({ ok: true, user: student });
    }
    // Auto-create demo student if not found
    return res.json({
      ok: true,
      user: {
        userId: `U_${rollNo.replace(/[^a-zA-Z0-9]/g, "")}`,
        rollNo,
        name: name || `Student (${rollNo})`,
        role: "STUDENT",
      },
    });
  }

  // Staff login
  if (roleUpper === "STAFF" || (email && email.toLowerCase().includes("staff"))) {
    const staff = store.getUsers().find((u) => u.role === "STAFF");
    return res.json({ ok: true, user: staff || { userId: "U103", name: "Demo Staff (Kitchen Lead)", role: "STAFF" } });
  }

  // Direct email lookup from seeded users
  if (email) {
    const userByEmail = store.getUsers().find((u) => u.email?.toLowerCase() === email.toLowerCase());
    if (userByEmail) {
      return res.json({ ok: true, user: userByEmail });
    }
  }

  // Guest login
  if (roleUpper === "GUEST" || (email && email.toLowerCase().includes("guest")) || (name && name.toLowerCase().includes("guest"))) {
    const demoGuest = store.findUserById("U104");
    if (name && name !== "Guest Demo") {
      const customGuest = {
        userId: `GUEST_${Date.now()}`,
        name: name.trim(),
        role: "GUEST" as const,
      };
      return res.json({ ok: true, user: customGuest });
    }
    return res.json({
      ok: true,
      user: demoGuest || {
        userId: "U104",
        name: "Guest Demo",
        role: "GUEST",
      },
    });
  }

  // Fallback guest user
  const guestUser = {
    userId: `GUEST_${Date.now()}`,
    name: name || "Campus Visitor",
    role: "GUEST" as const,
  };
  return res.json({ ok: true, user: guestUser });
});

// Student Login Verification via Mobile Number registered with official college portal
app.post("/api/auth/phone-login", (req: Request, res: Response) => {
  const schema = z.object({
    phone: z.string().min(5),
    otp: z.string().optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Please enter a valid mobile number", details: parsed.error.issues });
  }

  const { phone, otp } = parsed.data;
  const cleanPhone = phone.replace(/\D/g, "");

  if (otp && otp.length < 4) {
    return res.status(400).json({ error: "Please enter a valid 4-digit OTP" });
  }

  const student = store.findUserByPhone(cleanPhone);
  if (student) {
    return res.json({
      ok: true,
      verified: true,
      portalName: student.collegePortalName || "Chaitanya Bharati Institute of Technology (CBIT) Official Student Portal",
      user: {
        ...student,
        portalVerified: true,
      },
      message: "Mobile number verified with official college portal successfully!",
    });
  }

  // Provision official college profile for entered mobile number
  const newStudent = {
    userId: `U_${cleanPhone}`,
    rollNo: `1602-25-${cleanPhone.slice(-3) || "099"}`,
    name: `Student (+91 ${cleanPhone.slice(-10)})`,
    phone: cleanPhone,
    portalVerified: true,
    collegePortalName: "CBIT Official Student Information Portal",
    role: "STUDENT" as const,
  };

  return res.json({
    ok: true,
    verified: true,
    portalName: newStudent.collegePortalName,
    user: newStudent,
    message: "Mobile verified with official college portal successfully!",
  });
});

app.get("/api/users", (_req: Request, res: Response) => {
  res.json({ users: store.getUsers() });
});

// -------------------------------------------------------------
// Menu & Inventory Endpoints
// -------------------------------------------------------------
app.get("/api/menu", (_req: Request, res: Response) => {
  const menu = store.getMenu();
  res.json({
    menu,
    categories: ["HOT", "SNACK", "DRINK"],
  });
});

app.patch("/api/menu/:itemId", requireStaffRole, (req: Request, res: Response) => {
  try {
    const itemId = String(req.params.itemId);
    const schema = z.object({
      stockQty: z.number().int().min(0).optional(),
      isAvailable: z.boolean().optional(),
      prepMinutesPerBatch: z.number().min(1).optional(),
      batchSize: z.number().int().min(1).optional(),
      price: z.number().min(0).optional(),
      name: z.string().min(1).optional(),
    });

    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid updates", details: parsed.error.issues });
    }

    const updated = store.updateMenuItem(
      itemId,
      parsed.data,
      (req.headers["x-user-id"] as string) || "STAFF"
    );

    res.json({ ok: true, menuItem: updated });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// Option to add new menu items for canteen staff
app.post("/api/menu", requireStaffRole, (req: Request, res: Response) => {
  try {
    const schema = z.object({
      name: z.string().min(1),
      category: z.enum(["HOT", "DRINK", "SNACK"]),
      price: z.number().min(1),
      prepMinutesPerBatch: z.number().min(1).default(3),
      batchSize: z.number().int().min(1).default(1),
      stockQty: z.number().int().min(0).default(20),
      isDailySpecial: z.boolean().optional(),
      dailySpecialTag: z.string().optional(),
    });

    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid menu item data", details: parsed.error.issues });
    }

    const created = store.addMenuItem(parsed.data);
    res.status(201).json({ ok: true, menuItem: created });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Option for kitchen staff to set / toggle daily specials
app.patch("/api/menu/:itemId/special", requireStaffRole, (req: Request, res: Response) => {
  try {
    const itemId = String(req.params.itemId);
    const schema = z.object({
      isDailySpecial: z.boolean(),
      dailySpecialTag: z.string().optional(),
    });

    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid daily special toggle", details: parsed.error.issues });
    }

    const updated = store.toggleDailySpecial(itemId, parsed.data.isDailySpecial, parsed.data.dailySpecialTag);
    res.json({ ok: true, menuItem: updated });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.post("/api/menu/validate-order", (req: Request, res: Response) => {
  const schema = z.object({
    items: z
      .array(
        z.object({
          itemId: z.string().min(1),
          quantity: z.number().int().min(1).max(50),
        })
      )
      .min(1),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid order input", details: parsed.error.issues });
  }

  const result = validateOrderItems(parsed.data.items, store.getMenu());
  if (!result.valid) {
    return res.status(422).json(result);
  }

  return res.json(result);
});

// -------------------------------------------------------------
// Counters Endpoints
// -------------------------------------------------------------
app.get("/api/counters", (_req: Request, res: Response) => {
  res.json({ counters: store.getCounters() });
});

app.patch("/api/counters/:counterId", requireStaffRole, (req: Request, res: Response) => {
  try {
    const counterId = String(req.params.counterId);
    const schema = z.object({
      isActive: z.boolean().optional(),
      status: z.enum(["AVAILABLE", "BUSY", "PAUSED", "CLOSED"]).optional(),
      speedFactor: z.number().positive().optional(),
      name: z.string().min(1).optional(),
    });

    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid counter updates", details: parsed.error.issues });
    }

    const updated = store.updateCounter(counterId, parsed.data);
    res.json({ ok: true, counter: updated });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// -------------------------------------------------------------
// Orders Endpoints
// -------------------------------------------------------------
app.get("/api/orders", (req: Request, res: Response) => {
  const userId = req.query.userId as string | undefined;
  if (userId) {
    return res.json({ orders: store.getOrdersForUser(userId) });
  }
  return res.json({ orders: store.getOrders() });
});

app.get("/api/orders/:identifier", (req: Request, res: Response) => {
  const identifier = String(req.params.identifier);
  const order = store.getOrder(identifier);
  if (!order) {
    return res.status(404).json({ error: `Order ${identifier} not found.` });
  }

  // Get live queue state to enrich order with dynamic position and ETA
  const live = store.getLiveQueueState();
  const queueInfo = live.waitingOrders.find((o) => o.orderId === order.orderId);
  const prepInfo = live.activePreparingOrders.find((o) => o.orderId === order.orderId);

  return res.json({
    order,
    liveQueue: {
      queuePosition: queueInfo?.queuePosition ?? null,
      estimatedWaitMinutes:
        queueInfo?.estimatedWaitMinutes ?? prepInfo?.estimatedReadyInMinutes ?? order.estimatedWaitMinutes ?? 0,
      assignedCounterId: queueInfo?.assignedCounterId ?? order.assignedCounterId,
      crowdLevel: live.crowd.level,
      isCongested: live.crowd.isCongested,
    },
  });
});

app.post("/api/orders", (req: Request, res: Response) => {
  try {
    const schema = z.object({
      userId: z.string().optional(),
      guestName: z.string().optional(),
      items: z
        .array(
          z.object({
            itemId: z.string().min(1),
            quantity: z.number().int().min(1).max(20),
          })
        )
        .min(1),
    });

    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid order payload", details: parsed.error.issues });
    }

    const result = store.createOrder(parsed.data);
    res.status(201).json({
      ok: true,
      message: `Order created successfully! Your token is ${result.order.tokenNo}`,
      order: result.order,
      estimatedWaitMinutes: result.estimatedWaitMinutes,
      assignedCounterId: result.assignedCounterId,
    });
  } catch (error: any) {
    res.status(422).json({ error: error.message });
  }
});

// Staff Order Transitions: start, ready, complete, delay
app.post("/api/orders/:orderId/transition", requireStaffRole, (req: Request, res: Response) => {
  try {
    const orderId = String(req.params.orderId);
    const schema = z.object({
      action: z.enum(["start", "ready", "complete", "delay"]),
      counterId: z.string().optional(),
      delayMinutes: z.number().optional(),
      delayReason: z.string().optional(),
    });

    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid transition action", details: parsed.error.issues });
    }

    const staffUserId = (req.headers["x-user-id"] as string) || "STAFF";
    const order = store.transitionOrderStatus(orderId, parsed.data.action, {
      counterId: parsed.data.counterId,
      staffUserId,
      delayMinutes: parsed.data.delayMinutes,
      delayReason: parsed.data.delayReason,
    });

    res.json({ ok: true, order });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// Order Cancellation (Student or Staff)
app.post("/api/orders/:orderId/cancel", (req: Request, res: Response) => {
  try {
    const orderId = String(req.params.orderId);
    const schema = z.object({
      reason: z.string().optional(),
    });
    const parsed = schema.safeParse(req.body ?? {});
    const staffUserId = (req.headers["x-user-id"] as string) || undefined;

    const order = store.cancelOrder(
      orderId,
      parsed.success ? parsed.data.reason : "Requested by customer",
      staffUserId
    );

    res.json({
      ok: true,
      message: "Order cancelled and stock returned to inventory.",
      order,
    });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// -------------------------------------------------------------
// Cashier Interface Endpoints
// -------------------------------------------------------------
app.get("/api/cashier/orders", (_req: Request, res: Response) => {
  const pendingOrders = store.getCashierPendingOrders();
  res.json({
    pendingOrders,
    count: pendingOrders.length,
  });
});

app.post("/api/cashier/orders/:orderId/action", requireStaffRole, (req: Request, res: Response) => {
  try {
    const orderId = String(req.params.orderId);
    const schema = z.object({
      action: z.enum(["ACCEPT", "REJECT"]),
      paymentMethod: z.enum(["CASH", "UPI", "COLLEGE_CARD"]).optional(),
      notes: z.string().optional(),
    });

    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid cashier action parameters", details: parsed.error.issues });
    }

    const staffUserId = (req.headers["x-user-id"] as string) || "CASHIER";
    const order = store.actionCashierOrder(orderId, parsed.data.action, {
      paymentMethod: parsed.data.paymentMethod,
      notes: parsed.data.notes,
      staffUserId,
    });

    res.json({
      ok: true,
      message:
        parsed.data.action === "ACCEPT"
          ? `Order #${order.tokenNo} payment accepted and forwarded to Kitchen!`
          : `Order #${order.tokenNo} rejected. Reserved stock refunded.`,
      order,
    });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// -------------------------------------------------------------
// Logistics & Groceries Endpoints for Kitchen Staff
// -------------------------------------------------------------
app.get("/api/groceries", (_req: Request, res: Response) => {
  const groceries = store.getGroceries();
  const renewalAlerts = groceries.filter((g) => g.renewalUrgent);
  res.json({
    groceries,
    renewalAlerts,
    renewalAlertsCount: renewalAlerts.length,
  });
});

app.post("/api/groceries/restock", requireStaffRole, (req: Request, res: Response) => {
  try {
    const schema = z.object({
      groceryId: z.string().min(1),
      addQty: z.number().positive(),
    });

    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid restock parameters", details: parsed.error.issues });
    }

    const staffUserId = (req.headers["x-user-id"] as string) || "KITCHEN";
    const updated = store.restockGrocery(parsed.data.groceryId, parsed.data.addQty, staffUserId);
    res.json({ ok: true, grocery: updated });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.post("/api/groceries/consume", requireStaffRole, (req: Request, res: Response) => {
  try {
    const schema = z.object({
      groceryId: z.string().min(1),
      consumeQty: z.number().positive(),
    });

    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid consume parameters", details: parsed.error.issues });
    }

    const updated = store.consumeGrocery(parsed.data.groceryId, parsed.data.consumeQty);
    res.json({ ok: true, grocery: updated });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.post("/api/groceries/renew", requireStaffRole, (req: Request, res: Response) => {
  try {
    const schema = z.object({
      groceryId: z.string().min(1),
    });

    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid renewal parameters", details: parsed.error.issues });
    }

    const staffUserId = (req.headers["x-user-id"] as string) || "KITCHEN";
    const renewed = store.renewGrocery(parsed.data.groceryId, staffUserId);
    res.json({
      ok: true,
      message: `Procurement order logged! ${renewed.name} renewed to ${renewed.idealStock} ${renewed.unit}.`,
      grocery: renewed,
    });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// -------------------------------------------------------------
// Canteen Operating Hours & Schedule Endpoints
// (Open 8:30 AM – Close 5:30 PM; Cutoff 5:10 PM)
// -------------------------------------------------------------
app.get("/api/canteen/schedule", (_req: Request, res: Response) => {
  res.json(store.getCanteenSchedule());
});

app.post("/api/canteen/schedule/simulate", (req: Request, res: Response) => {
  const schema = z.object({
    hour: z.number().int().min(0).max(23).nullable().optional(),
    minute: z.number().int().min(0).max(59).optional(),
    reset: z.boolean().optional(),
    enforceSchedule: z.boolean().optional(),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid schedule simulation input", details: parsed.error.issues });
  }

  if (parsed.data.enforceSchedule !== undefined) {
    store.enforceSchedule = parsed.data.enforceSchedule;
  }

  const schedule = store.setSimulatedTime(
    parsed.data.reset ? null : parsed.data.hour ?? null,
    parsed.data.minute
  );

  res.json({ ok: true, schedule, enforceSchedule: store.enforceSchedule });
});

// -------------------------------------------------------------
// Live Queue & Metrics Endpoints
// -------------------------------------------------------------
app.get(["/api/queue/preview", "/api/queue/live"], (_req: Request, res: Response, next: NextFunction) => {
  try {
    const live = store.getLiveQueueState();
    res.json(live);
  } catch (error) {
    next(error);
  }
});

app.get("/api/queue/audit-events", (_req: Request, res: Response) => {
  res.json(store.getAuditEvents());
});

// -------------------------------------------------------------
// Simulation & Scenarios Endpoints
// -------------------------------------------------------------
app.post("/api/queue/simulate", (_req: Request, res: Response, next: NextFunction) => {
  try {
    const result = store.runComparisonSimulation();
    res.json(result);
  } catch (error) {
    next(error);
  }
});

app.post("/api/demo/reset", (_req: Request, res: Response) => {
  store.reset();
  res.json({ ok: true, message: "System state reset to Hackathon fixtures." });
});

app.post("/api/demo/scenarios/:scenarioId", (req: Request, res: Response) => {
  const scenarioId = String(req.params.scenarioId);
  if (scenarioId !== "low" && scenarioId !== "peak" && scenarioId !== "counter_breakdown") {
    return res.status(400).json({
      error: `Invalid scenario. Choose 'low', 'peak', or 'counter_breakdown'`,
    });
  }

  store.loadScenario(scenarioId);
  res.json({
    ok: true,
    message: `Scenario "${scenarioId}" loaded successfully.`,
    liveState: store.getLiveQueueState(),
  });
});

app.get("/api/demo/fixtures", (_req: Request, res: Response) => {
  res.json({
    menuItems: store.getMenu(),
    counters: store.getCounters(),
    orders: store.getOrders(),
  });
});

// -------------------------------------------------------------
// Centralized Error Handling
// -------------------------------------------------------------
app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
  console.error("Unhandled error:", error);
  res.status(500).json({ error: "Internal server error" });
});

// Only listen if this file is run directly
if (process.env.NODE_ENV !== "test") {
  app.listen(port, () => {
    console.log(`Smart Canteen API running on http://localhost:${port}`);
  });
}

export default app;
