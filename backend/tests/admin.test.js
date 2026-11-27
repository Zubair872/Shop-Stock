import test from "node:test";
import assert from "node:assert/strict";
import User from "../models/User.js";
import AdminLog from "../models/AdminLog.js";
import { env } from "../config/env.js";
import { serializeUser } from "../utils/serialize.js";
import { evaluateAccountAccess, isAccountExpired } from "../utils/subscription.js";
import { requireRole } from "../middleware/auth.js";

test("env.trialDays defaults to 7", () => {
  assert.equal(env.trialDays, 7);
});

test("User schema supports superadmin role and subscription fields", () => {
  const admin = new User({
    name: "Malik",
    email: "malik@shopstock.pk",
    password: "SuperSecretPassword123",
    role: "superadmin",
    plan: "paid",
    status: "active",
    notes: "Founder account",
  });
  assert.equal(admin.validateSync(), undefined);
  const serialized = serializeUser(admin);
  assert.equal(serialized.role, "superadmin");
  assert.equal(serialized.plan, "paid");
  assert.equal(serialized.status, "active");
  assert.equal(serialized.notes, undefined);
});

test("AdminLog schema validates audit entries", () => {
  const log = new AdminLog({
    admin: "507f1f77bcf86cd799439011",
    adminEmail: "malik@shopstock.pk",
    targetAccount: "507f1f77bcf86cd799439012",
    action: "extend_expiry",
    details: { extendDays: 30 },
  });
  assert.equal(log.validateSync(), undefined);
});

test("evaluateAccountAccess blocks expired trial and includes WhatsApp number", () => {
  const now = new Date("2026-11-27T10:00:00Z");
  const past = new Date("2026-11-20T10:00:00Z");
  const owner = {
    role: "owner",
    plan: "trial",
    status: "active",
    trialEndsAt: past,
    expiresAt: past,
    isActive: true,
  };
  assert.equal(isAccountExpired(owner, now), true);
  const res = evaluateAccountAccess(owner, now, "923001234567");
  assert.equal(res.allowed, false);
  assert.equal(res.status, 403);
  assert.equal(res.code, "TRIAL_EXPIRED");
  assert.ok(res.message.includes("923001234567"));
});

test("evaluateAccountAccess blocks suspended account and allows active paid/trial", () => {
  const now = new Date("2026-11-27T10:00:00Z");
  const future = new Date("2026-12-27T10:00:00Z");

  const suspended = evaluateAccountAccess(
    { role: "owner", plan: "paid", status: "suspended", isActive: true },
    now,
    "923001234567"
  );
  assert.equal(suspended.allowed, false);
  assert.equal(suspended.code, "ACCOUNT_SUSPENDED");
  assert.ok(suspended.message.includes("923001234567"));

  const activeTrial = evaluateAccountAccess(
    { role: "owner", plan: "trial", status: "active", trialEndsAt: future, expiresAt: future, isActive: true },
    now,
    "923001234567"
  );
  assert.equal(activeTrial.allowed, true);

  const lifetimePaid = evaluateAccountAccess(
    { role: "owner", plan: "paid", status: "active", expiresAt: null, isActive: true },
    now,
    "923001234567"
  );
  assert.equal(lifetimePaid.allowed, true);
});

test("requireRole('superadmin') returns 403 for normal users and allows superadmin", () => {
  const guard = requireRole("superadmin");
  const makeRes = () => {
    const res = { statusCode: 200, body: null };
    res.status = (code) => { res.statusCode = code; return res; };
    res.json = (data) => { res.body = data; return res; };
    return res;
  };

  let nextCalled = 0;
  const normalRes = makeRes();
  guard({ userRole: "owner" }, normalRes, () => { nextCalled += 1; });
  assert.equal(nextCalled, 0);
  assert.equal(normalRes.statusCode, 403);

  const adminRes = makeRes();
  guard({ userRole: "superadmin" }, adminRes, () => { nextCalled += 1; });
  assert.equal(nextCalled, 1);
  assert.equal(adminRes.statusCode, 200);
});
