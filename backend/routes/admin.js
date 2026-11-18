const express = require("express");
const crypto = require("crypto");
const Event = require("../models/Event");
const Ticket = require("../models/Ticket");
const rateLimit = require("../utils/rateLimit");

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const IMAGE_RE = /^(https:\/\/[^\s"'<>]+|images\/[A-Za-z0-9._\-\/]+)$/;
const escapeRegex = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

function requireAdmin(req, res, next) {
  const key = process.env.ADMIN_KEY;
  const given = String(req.headers["x-admin-key"] || "");
  const ok = key && given.length === key.length && crypto.timingSafeEqual(Buffer.from(given), Buffer.from(key));
  if (!ok) return res.status(401).json({ success: false, message: "Not authorised" });
  next();
}

function displayDate(iso) {
  return new Date(iso + "T00:00:00Z").toLocaleDateString("en-US", {
    year: "numeric", month: "long", day: "numeric", timeZone: "UTC",
  });
}

// Validate event fields from the admin form. Returns { error } or { data }.
function cleanEvent(b, { partial = false } = {}) {
  const d = {};
  const str = (k, max) => {
    if (b[k] === undefined) return null;
    const v = String(b[k]).trim();
    if (v.length > max) return `${k} is too long (max ${max})`;
    d[k] = v;
    return null;
  };
  for (const [k, max] of [["title", 120], ["time", 80], ["location", 120], ["venueAddress", 200], ["description", 1000], ["ticketType", 30]]) {
    const err = str(k, max); if (err) return { error: err };
  }
  if (!partial && !d.title) return { error: "Title is required" };
  if (d.title !== undefined && !d.title) return { error: "Title is required" };

  if (b.dateISO !== undefined) {
    const v = String(b.dateISO).trim();
    if (v && !ISO_DATE_RE.test(v)) return { error: "Date must be a real date" };
    if (v && isNaN(new Date(v + "T00:00:00Z"))) return { error: "Date must be a real date" };
    d.dateISO = v;
    if (v) d.date = displayDate(v);
  }
  if (b.date !== undefined && !d.date) {
    const v = String(b.date).trim();
    if (v.length > 60) return { error: "date is too long" };
    d.date = v;
  }
  if (b.price !== undefined || !partial) {
    const price = Number(b.price);
    if (!Number.isFinite(price) || price < 0 || price > 10000000) return { error: "Price must be a number from 0 to 10,000,000" };
    d.price = Math.round(price);
  }
  if (b.capacity !== undefined) {
    if (b.capacity === null || b.capacity === "") d.capacity = null;
    else {
      const c = Number(b.capacity);
      if (!Number.isInteger(c) || c < 1 || c > 1000000) return { error: "Capacity must be a whole number of 1 or more (or empty for unlimited)" };
      d.capacity = c;
    }
  }
  if (b.image !== undefined) {
    const v = String(b.image).trim();
    if (v && !IMAGE_RE.test(v)) return { error: "Image must be an https:// link or an images/ file path" };
    d.image = v;
  }
  if (b.active !== undefined) d.active = !!b.active;
  return { data: d };
}

function csvCell(v) {
  let s = v == null ? "" : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s; // stop spreadsheet formula injection
  return `"${s.replace(/"/g, '""')}"`;
}

const statusOf = (t) => (t.cancelledAt ? "cancelled" : t.checkedInAt ? "checked-in" : "valid");

module.exports = function createAdminRouter({ generateTicketsAfterPayment, emailTicket }) {
  const router = express.Router();
  router.use(rateLimit({ windowMs: 60 * 1000, max: 240 }));
  router.use(requireAdmin);

  // Which event does a ticket belong to? Newer tickets store eventId; older ones are matched by title.
  async function eventIndex() {
    const events = await Event.find({ deleted: { $ne: true } }).sort({ id: 1 }).lean();
    const byTitle = Object.fromEntries(events.map((e) => [e.title, e.id]));
    const keyOf = (t) => t.eventId ?? byTitle[t.event?.title] ?? null;
    return { events, keyOf };
  }

  async function ticketFilter(query) {
    const f = {};
    if (query.event) {
      const ev = await Event.findOne({ id: Number(query.event) }).lean();
      if (!ev) return { empty: true };
      f.$or = [{ eventId: ev.id }, { eventId: { $exists: false }, "event.title": ev.title }];
    }
    if (query.status === "valid") { f.cancelledAt = null; f.checkedInAt = null; }
    else if (query.status === "checked-in") { f.cancelledAt = null; f.checkedInAt = { $ne: null }; }
    else if (query.status === "cancelled") f.cancelledAt = { $ne: null };
    const q = String(query.q || "").trim().slice(0, 80);
    if (q) {
      const rx = { $regex: escapeRegex(q), $options: "i" };
      const or = [{ ticketId: rx }, { "attendee.email": rx }, { "attendee.fullName": rx }, { "attendee.phone": rx }];
      f.$and = [...(f.$and || []), { $or: or }];
    }
    return { filter: f };
  }

  const slim = (t) => ({
    ticketId: t.ticketId, eventId: t.eventId ?? null, eventTitle: t.event?.title, name: t.attendee?.fullName,
    email: t.attendee?.email, phone: t.attendee?.phone, type: t.ticketDetails?.type, price: t.ticketDetails?.price ?? 0,
    complimentary: !!t.complimentary, paymentReference: t.paymentReference, purchasedAt: t.purchasedAt,
    checkedInAt: t.checkedInAt || null, cancelledAt: t.cancelledAt || null, status: statusOf(t),
  });

  router.get("/ping", (req, res) => res.json({ success: true }));

  // ---------- dashboard ----------
  router.get("/stats", async (req, res) => {
    try {
      const { events, keyOf } = await eventIndex();
      const tickets = await Ticket.find({}).lean();
      const per = Object.fromEntries(events.map((e) => [e.id, { id: e.id, title: e.title, price: e.price, active: e.active, capacity: e.capacity ?? null, sold: 0, revenue: 0, checkedIn: 0, complimentary: 0, cancelled: 0 }]));
      const totals = { sold: 0, revenue: 0, checkedIn: 0, complimentary: 0, cancelled: 0, eventsLive: events.filter((e) => e.active).length };
      for (const t of tickets) {
        const row = per[keyOf(t)];
        if (t.cancelledAt) { totals.cancelled++; if (row) row.cancelled++; continue; }
        const price = t.complimentary ? 0 : (t.ticketDetails?.price || 0);
        totals.sold++; totals.revenue += price;
        if (t.checkedInAt) totals.checkedIn++;
        if (t.complimentary) totals.complimentary++;
        if (row) { row.sold++; row.revenue += price; if (t.checkedInAt) row.checkedIn++; if (t.complimentary) row.complimentary++; }
      }
      res.json({ success: true, totals, events: Object.values(per) });
    } catch (err) {
      console.error("Admin stats error:", err.message);
      res.status(500).json({ success: false, message: "Could not load stats" });
    }
  });

  // ---------- events ----------
  router.get("/events", async (req, res) => {
    const { events } = await eventIndex();
    res.json({ success: true, events });
  });

  router.post("/events", async (req, res) => {
    try {
      const { error, data } = cleanEvent(req.body);
      if (error) return res.status(400).json({ success: false, message: error });
      const last = await Event.find({}).sort({ id: -1 }).limit(1).lean();
      const id = (last[0]?.id || 0) + 1;
      const ev = await Event.create({ ticketType: "standard", active: true, ...data, id });
      res.status(201).json({ success: true, event: ev });
    } catch (err) {
      console.error("Admin create event error:", err.message);
      res.status(500).json({ success: false, message: "Could not create event" });
    }
  });

  router.put("/events/:id", async (req, res) => {
    try {
      const { error, data } = cleanEvent(req.body, { partial: true });
      if (error) return res.status(400).json({ success: false, message: error });
      const ev = await Event.findOneAndUpdate({ id: Number(req.params.id), deleted: { $ne: true } }, data, { new: true }).lean();
      if (!ev) return res.status(404).json({ success: false, message: "Event not found" });
      res.json({ success: true, event: ev });
    } catch (err) {
      res.status(500).json({ success: false, message: "Could not update event" });
    }
  });

  // "Remove" hides the event everywhere. Tickets already sold keep working.
  router.delete("/events/:id", async (req, res) => {
    try {
      const ev = await Event.findOneAndUpdate({ id: Number(req.params.id) }, { deleted: true, active: false }, { new: true }).lean();
      if (!ev) return res.status(404).json({ success: false, message: "Event not found" });
      res.json({ success: true, message: "Event removed" });
    } catch (err) {
      res.status(500).json({ success: false, message: "Could not remove event" });
    }
  });

  // ---------- tickets ----------
  router.get("/tickets", async (req, res) => {
    try {
      const { filter, empty } = await ticketFilter(req.query);
      if (empty) return res.json({ success: true, tickets: [], total: 0, page: 1 });
      const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 50, 1), 200);
      const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
      const [total, rows] = await Promise.all([
        Ticket.countDocuments(filter),
        Ticket.find(filter).sort({ purchasedAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
      ]);
      res.json({ success: true, tickets: rows.map(slim), total, page, limit });
    } catch (err) {
      console.error("Admin tickets error:", err.message);
      res.status(500).json({ success: false, message: "Could not load tickets" });
    }
  });

  router.post("/tickets/issue", async (req, res) => {
    try {
      const ev = await Event.findOne({ id: Number(req.body.eventId), deleted: { $ne: true } }).lean();
      if (!ev) return res.status(400).json({ success: false, message: "Pick an event" });
      const name = String(req.body.name || "").trim().slice(0, 100);
      const email = String(req.body.email || "").trim().toLowerCase();
      const phone = String(req.body.phone || "").trim().slice(0, 30);
      const quantity = parseInt(req.body.quantity, 10);
      if (!name) return res.status(400).json({ success: false, message: "Guest name is required" });
      if (!EMAIL_RE.test(email)) return res.status(400).json({ success: false, message: "Enter a valid email address" });
      if (!Number.isInteger(quantity) || quantity < 1 || quantity > 50) {
        return res.status(400).json({ success: false, message: "Quantity must be 1 to 50" });
      }
      if (ev.capacity != null) {
        const sold = await Ticket.countDocuments({ eventId: ev.id, cancelledAt: null });
        if (sold + quantity > ev.capacity) {
          return res.status(409).json({ success: false, message: `Only ${Math.max(0, ev.capacity - sold)} place(s) left. Raise the event capacity first.` });
        }
      }
      const tickets = await generateTicketsAfterPayment({
        email, event: ev, quantity, attendeeName: name, attendeePhone: phone, complimentary: true, sendEmail: false,
        paymentReference: `COMP-${Date.now()}-${crypto.randomBytes(3).toString("hex").toUpperCase()}`,
      });
      let emailed = false;
      if (req.body.sendEmail !== false) {
        try {
          const results = await Promise.all(tickets.map((t) => emailTicket(t, { ...ev, price: 0 }).catch(() => ({ success: false }))));
          emailed = results.every((r) => r && r.success !== false);
        } catch (e) { emailed = false; }
      }
      res.status(201).json({ success: true, emailed, tickets: tickets.map(slim) });
    } catch (err) {
      console.error("Admin issue error:", err.message);
      res.status(500).json({ success: false, message: "Could not issue tickets" });
    }
  });

  async function updateTicket(req, res, patch, okMessage, guard) {
    try {
      const t = await Ticket.findOne({ ticketId: req.params.ticketId }).lean();
      if (!t) return res.status(404).json({ success: false, message: "Ticket not found" });
      const problem = guard && guard(t);
      if (problem) return res.status(409).json({ success: false, message: problem });
      const updated = await Ticket.findOneAndUpdate({ ticketId: req.params.ticketId }, patch, { new: true }).lean();
      res.json({ success: true, message: okMessage, ticket: slim(updated) });
    } catch (err) {
      res.status(500).json({ success: false, message: "Could not update ticket" });
    }
  }
  router.post("/tickets/:ticketId/cancel", (req, res) =>
    updateTicket(req, res, { cancelledAt: new Date() }, "Ticket cancelled", (t) => (t.cancelledAt ? "Already cancelled" : null)));
  router.post("/tickets/:ticketId/restore", (req, res) =>
    updateTicket(req, res, { cancelledAt: null }, "Ticket restored", (t) => (!t.cancelledAt ? "Ticket is not cancelled" : null)));
  router.post("/tickets/:ticketId/checkin", (req, res) =>
    req.body.undo
      ? updateTicket(req, res, { checkedInAt: null }, "Check-in undone")
      : updateTicket(req, res, { checkedInAt: new Date() }, "Checked in", (t) =>
          t.cancelledAt ? "Ticket is cancelled" : t.checkedInAt ? "Already checked in" : null));

  router.post("/tickets/:ticketId/resend", async (req, res) => {
    try {
      const t = await Ticket.findOne({ ticketId: req.params.ticketId }).lean();
      if (!t) return res.status(404).json({ success: false, message: "Ticket not found" });
      if (t.cancelledAt) return res.status(409).json({ success: false, message: "Ticket is cancelled" });
      const r = await emailTicket(t, { ...t.event, ticketType: t.ticketDetails?.type, price: t.complimentary ? 0 : t.ticketDetails?.price });
      if (r && r.success === false) return res.status(502).json({ success: false, message: "Email could not be sent" });
      res.json({ success: true, message: `Ticket sent to ${t.attendee.email}` });
    } catch (err) {
      console.error("Admin resend error:", err.message);
      res.status(500).json({ success: false, message: "Could not resend ticket" });
    }
  });

  // ---------- check-in list ----------
  router.get("/checkins", async (req, res) => {
    try {
      const { filter, empty } = await ticketFilter({ event: req.query.event, q: req.query.q });
      if (empty) return res.json({ success: true, total: 0, admitted: 0, tickets: [] });
      filter.cancelledAt = null;
      const rows = await Ticket.find(filter).sort({ "attendee.fullName": 1 }).limit(5000).lean();
      const tickets = rows.map(slim);
      res.json({ success: true, total: tickets.length, admitted: tickets.filter((t) => t.checkedInAt).length, tickets });
    } catch (err) {
      res.status(500).json({ success: false, message: "Could not load check-in list" });
    }
  });

  // ---------- CSV export ----------
  router.get("/export.csv", async (req, res) => {
    try {
      const { filter, empty } = await ticketFilter(req.query);
      const rows = empty ? [] : await Ticket.find(filter).sort({ purchasedAt: -1 }).limit(50000).lean();
      const head = ["Ticket ID", "Event", "Name", "Email", "Phone", "Type", "Price (NGN)", "Source", "Payment reference", "Purchased", "Status", "Checked in at"];
      const lines = [head.map(csvCell).join(",")];
      for (const t of rows.map(slim)) {
        lines.push([t.ticketId, t.eventTitle, t.name, t.email, t.phone, t.type, t.price, t.complimentary ? "Complimentary" : "Paid",
          t.paymentReference, t.purchasedAt, t.status, t.checkedInAt ? new Date(t.checkedInAt).toISOString() : ""].map(csvCell).join(","));
      }
      res.set("Content-Type", "text/csv; charset=utf-8");
      res.set("Content-Disposition", `attachment; filename="kyomatos-tickets-${new Date().toISOString().slice(0, 10)}.csv"`);
      res.send("﻿" + lines.join("\r\n"));
    } catch (err) {
      res.status(500).json({ success: false, message: "Could not export" });
    }
  });

  return router;
};