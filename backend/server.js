const express = require("express");
const cors = require("cors");
const path = require("path");
const fs = require("fs");
const PDFDocument = require("pdfkit");
const QRCode = require("qr-image");
const axios = require("axios");
const sendEmail = require("./utils/sendEmail");
const connectDB = require("./config/db");
const Ticket = require("./models/Ticket");
const User = require("./models/User");
const Event = require("./models/Event");
const seedEvents = require("./utils/seedEvents");
const createAdminRouter = require("./routes/admin");
const requireAuth = require("./middleware/auth");
const authRoutes = require("./routes/auth");
const crypto = require("crypto");
const { signQr, verifyQr } = require("./utils/qr");
const rateLimit = require("./utils/rateLimit");
require("dotenv").config();

if (!process.env.JWT_SECRET) {
  console.error("JWT_SECRET is not set - refusing to start");
  process.exit(1);
}
const MAX_TICKETS_PER_ORDER = 10;

// Connect to MongoDB so tickets survive restarts/redeploys
connectDB().then(seedEvents);

// Global error handlers to avoid process exit on unhandled errors
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// After an uncaught exception the process state is unreliable: log it and exit so the host restarts it
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
  process.exit(1);
});

const app = express();
app.set('trust proxy', 1); // one proxy hop (Render/Railway) so req.ip is the real client

// Middleware
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || process.env.FRONTEND_URL || "http://localhost:5000")
  .split(",").map((o) => o.trim()).filter(Boolean);
app.use(cors({
  origin: (origin, cb) => (!origin || ALLOWED_ORIGINS.includes(origin) ? cb(null, true) : cb(null, false)),
}));
// Keep the raw body so the Paystack webhook signature can be verified
app.use(express.json({ verify: (req, res, buf) => { req.rawBody = buf; } }));
app.use(express.urlencoded({ extended: true }));

app.use("/api/auth", rateLimit({ windowMs: 15 * 60 * 1000, max: 30, message: "Too many attempts, try again in a few minutes" }), authRoutes);

// Serve frontend files
// (never expose the backend folder, .env, docs or other dotfiles)
app.use((req, res, next) => {
  if (/^\/backend(\/|$)/i.test(req.path) || /\.(md|bat|json)$/i.test(req.path) || /\/\./.test(req.path)) {
    return res.sendStatus(404);
  }
  next();
});
app.use(express.static(path.join(__dirname, ".."), { dotfiles: "ignore" }));


// Create PDFs directory
const pdfsDir = path.join(__dirname, "pdfs");
if (!fs.existsSync(pdfsDir)) {
  fs.mkdirSync(pdfsDir, { recursive: true });
}

// Paystack Configuration
const PAYSTACK_SECRET_KEY =
  process.env.PAYSTACK_SECRET_KEY || "sk_test_your_key_here";
const PAYSTACK_PUBLIC_KEY =
  process.env.PAYSTACK_PUBLIC_KEY || "pk_test_your_key_here";
const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:5000";
const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:5000";

// Generate professional ticket design (Concert Ticket Layout)
function generateProfessionalPDFTicket(ticket) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: [1100, 380], // Concert ticket size
        margin: 0,
        info: {
          Title: `Ticket for ${ticket.event.title}`,
          Author: "Kyomatos",
          Subject: "Event Ticket",
        },
      });

      const fileName = `ticket_${ticket.ticketId}.pdf`;
      const filePath = path.join(pdfsDir, fileName);
      const writeStream = fs.createWriteStream(filePath);

      doc.pipe(writeStream);

      // ===== LEFT SECTION - Event Name & Decorations =====
      const leftGradient = doc.linearGradient(0, 0, 280, 380);
      leftGradient.stop(0, "#CC1100");
      leftGradient.stop(1, "#8F0C00");
      doc.rect(0, 0, 280, 380).fill(leftGradient);

      // Decorative elements and event name
      doc
        .fillColor("#ffffff")
        .fontSize(18)
        .font("Helvetica")
        .text("* * *", 10, 30, { width: 260, align: "center" });

      // Event name (bold)
      doc
        .fillColor("#ffffff")
        .fontSize(38)
        .font("Helvetica-Bold")
        .text(ticket.event.title.toUpperCase(), 10, 80, {
          width: 260,
          align: "center",
          lineGap: 3,
        });

      // Bottom decorations
      doc
        .fillColor("#ffffff")
        .fontSize(18)
        .font("Helvetica")
        .text("* * *", 10, 180, { width: 260, align: "center" });

      // Ticket type badge
      doc
        .strokeColor("#E8200C")
        .lineWidth(2)
        .rect(30, 240, 220, 35)
        .stroke();
      doc
        .fillColor("#E8200C")
        .opacity(0.15)
        .rect(30, 240, 220, 35)
        .fill();
      doc.opacity(1);

      doc
        .fillColor("#ffffff")
        .fontSize(14)
        .font("Helvetica-Bold")
        .text(ticket.ticketDetails.type.toUpperCase(), 30, 248, {
          width: 220,
          align: "center",
        });

      // ===== MIDDLE SECTION - Event Details & Pills =====
      doc.fillColor("#0d0d0d").rect(280, 0, 500, 380).fill();

      // Event details
      const detailsX = 300;
      const detailsY = 30;

      // DATE
      doc
        .fillColor("#b0b0b0")
        .fontSize(10)
        .font("Helvetica-Bold")
        .text("DATE", detailsX, detailsY);

      doc
        .fillColor("#ffffff")
        .fontSize(13)
        .font("Helvetica")
        .text(ticket.event.date, detailsX, detailsY + 18);

      doc
        .strokeColor("rgba(204, 17, 0, 0.3)")
        .lineWidth(1)
        .moveTo(detailsX, detailsY + 35)
        .lineTo(detailsX + 180, detailsY + 35)
        .stroke();

      // VENUE
      doc
        .fillColor("#b0b0b0")
        .fontSize(10)
        .font("Helvetica-Bold")
        .text("VENUE", detailsX, detailsY + 50);

      doc
        .fillColor("#ffffff")
        .fontSize(13)
        .font("Helvetica")
        .text(ticket.event.location, detailsX, detailsY + 68, { width: 180 });

      doc
        .strokeColor("rgba(204, 17, 0, 0.3)")
        .lineWidth(1)
        .moveTo(detailsX, detailsY + 110)
        .lineTo(detailsX + 180, detailsY + 110)
        .stroke();

      // TIME
      doc
        .fillColor("#b0b0b0")
        .fontSize(10)
        .font("Helvetica-Bold")
        .text("TIME", detailsX, detailsY + 130);

      doc
        .fillColor("#ffffff")
        .fontSize(13)
        .font("Helvetica")
        .text(ticket.event.time, detailsX, detailsY + 148);

      // Detail Pills (ROW, SEAT, GATE)
      const pillsY = detailsY + 190;
      const pillWidth = 50;
      const pillHeight = 60;
      const pillGap = 20;

      // ROW Pill
      doc
        .strokeColor("#CC1100")
        .lineWidth(2)
        .rect(detailsX, pillsY, pillWidth, pillHeight)
        .stroke();
      doc
        .fillColor("rgba(204, 17, 0, 0.15)")
        .rect(detailsX, pillsY, pillWidth, pillHeight)
        .fill();

      doc
        .fillColor("#b0b0b0")
        .fontSize(8)
        .font("Helvetica-Bold")
        .text("ROW", detailsX + 5, pillsY + 8, { width: pillWidth - 10, align: "center" });

      const rowLetter = ticket.ticketDetails.row || "A";
      doc
        .fillColor("#E8200C")
        .fontSize(18)
        .font("Helvetica-Bold")
        .text(rowLetter, detailsX + 5, pillsY + 25, { width: pillWidth - 10, align: "center" });

      // SEAT Pill
      doc
        .strokeColor("#CC1100")
        .lineWidth(2)
        .rect(detailsX + pillWidth + pillGap, pillsY, pillWidth, pillHeight)
        .stroke();
      doc
        .fillColor("rgba(204, 17, 0, 0.15)")
        .rect(detailsX + pillWidth + pillGap, pillsY, pillWidth, pillHeight)
        .fill();

      doc
        .fillColor("#b0b0b0")
        .fontSize(8)
        .font("Helvetica-Bold")
        .text("SEAT", detailsX + pillWidth + pillGap + 5, pillsY + 8, {
          width: pillWidth - 10,
          align: "center",
        });

      const seatNumber = ticket.ticketDetails.seat || "01";
      doc
        .fillColor("#E8200C")
        .fontSize(18)
        .font("Helvetica-Bold")
        .text(seatNumber, detailsX + pillWidth + pillGap + 5, pillsY + 25, {
          width: pillWidth - 10,
          align: "center",
        });

      // GATE Pill
      doc
        .strokeColor("#CC1100")
        .lineWidth(2)
        .rect(detailsX + 2 * (pillWidth + pillGap), pillsY, pillWidth, pillHeight)
        .stroke();
      doc
        .fillColor("rgba(204, 17, 0, 0.15)")
        .rect(detailsX + 2 * (pillWidth + pillGap), pillsY, pillWidth, pillHeight)
        .fill();

      doc
        .fillColor("#b0b0b0")
        .fontSize(8)
        .font("Helvetica-Bold")
        .text("GATE", detailsX + 2 * (pillWidth + pillGap) + 5, pillsY + 8, {
          width: pillWidth - 10,
          align: "center",
        });

      const gateNumber = ticket.ticketDetails.gate || 1;
      doc
        .fillColor("#E8200C")
        .fontSize(18)
        .font("Helvetica-Bold")
        .text(gateNumber.toString(), detailsX + 2 * (pillWidth + pillGap) + 5, pillsY + 25, {
          width: pillWidth - 10,
          align: "center",
        });

      // Price Circle
      const priceX = detailsX + 400;
      const priceY = pillsY - 30;
      const priceRadius = 50;

      // Circle background with gradient effect
      doc
        .strokeColor("#E8200C")
        .lineWidth(3)
        .circle(priceX, priceY, priceRadius)
        .stroke();

      doc
        .fillColor("#CC1100")
        .opacity(0.2)
        .circle(priceX, priceY, priceRadius)
        .fill();
      doc.opacity(1);

      // Price text
      doc
        .fillColor("#ffffff")
        .fontSize(18)
        .font("Helvetica-Bold")
        .text("N", priceX - 20, priceY - 28);

      doc
        .fillColor("#ffffff")
        .fontSize(24)
        .font("Helvetica-Bold")
        .text((ticket.ticketDetails.price / 1000).toFixed(0) + "K", priceX - 30, priceY - 8);

      // ===== PERFORATED DIVIDER =====
      doc
        .strokeColor("#E8200C")
        .lineWidth(2)
        .dash(10, { space: 10 })
        .moveTo(780, 0)
        .lineTo(780, 380)
        .stroke();
      doc.undash();


      // ===== RIGHT SECTION - QR Code & ADMIT ONE =====
      doc.fillColor("#0d0d0d").rect(780, 0, 320, 380).fill();

      // QR Code background
      doc
        .fillColor("#ffffff")
        .rect(830, 50, 180, 180)
        .fill();

      // QR Code
      const qrData = signQr(ticket.ticketId);
      const qrImage = QRCode.imageSync(qrData, { type: "png", size: 10 });

      if (qrImage) {
        doc.image(qrImage, 840, 60, {
          width: 160,
          height: 160,
        });
      }

      // ADMIT ONE text
      doc
        .fillColor("#E8200C")
        .fontSize(20)
        .font("Helvetica-Bold")
        .text("ADMIT ONE", 780, 250, { width: 320, align: "center" });

      // Ticket ID / Number
      doc
        .fillColor("#b0b0b0")
        .fontSize(9)
        .font("Helvetica-Bold")
        .text(ticket.ticketId, 780, 290, {
          width: 320,
          align: "center",
          lineGap: 2,
        });

      // Footer
      doc
        .fillColor("#b0b0b0")
        .fontSize(8)
        .font("Helvetica")
        .text("Present this ticket at entrance", 20, 350);

      doc.end();

      writeStream.on("finish", () => {
        resolve({
          fileName,
          filePath,
          url: `/pdfs/${fileName}`,
        });
      });

      writeStream.on("error", reject);
    } catch (error) {
      reject(error);
    }
  });
}

// Paystack: Initialize payment (login required, price comes from the server)
app.post("/api/pay/initialize", rateLimit({ windowMs: 60 * 60 * 1000, max: 30 }), requireAuth, async (req, res) => {
  try {
    const quantity = parseInt(req.body.quantity, 10);
    const event = await Event.findOne({ id: Number(req.body.eventId), active: true, deleted: { $ne: true } }).lean();

    if (!event) {
      return res.status(400).json({ success: false, message: "This event is not on sale" });
    }
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > MAX_TICKETS_PER_ORDER) {
      return res.status(400).json({
        success: false,
        message: `Quantity must be between 1 and ${MAX_TICKETS_PER_ORDER}`,
      });
    }

    const user = await User.findById(req.user.userId).lean();
    if (!user) {
      return res.status(401).json({ success: false, message: "Account not found" });
    }

    if (event.capacity != null) {
      const sold = await Ticket.countDocuments({ eventId: event.id, cancelledAt: null });
      if (sold + quantity > event.capacity) {
        const left = Math.max(0, event.capacity - sold);
        return res.status(409).json({
          success: false,
          message: left === 0 ? "Sorry, this event is sold out" : `Only ${left} ticket(s) left`,
        });
      }
    }

    const amount = event.price * quantity; // naira, computed on the server
    const callbackUrl = `${FRONTEND_URL}/about.html?id=${event.id}`;

    const response = await axios.post(
      "https://api.paystack.co/transaction/initialize",
      {
        email: user.email,
        amount: amount * 100, // kobo
        callback_url: callbackUrl,
        metadata: {
          userId: String(user._id),
          eventId: event.id,
          price: event.price, // price at the moment of purchase (a later price change won't break this order)
          quantity,
          attendeeName: user.name,
          attendeePhone: user.phone || "",
        },
      },
      {
        headers: {
          Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
          "Content-Type": "application/json",
        },
      },
    );

    res.json({
      success: true,
      message: "Payment initialized",
      data: {
        authorization_url: response.data.data.authorization_url,
        access_code: response.data.data.access_code,
        reference: response.data.data.reference,
      },
    });
  } catch (error) {
    console.error("Paystack initialization error:", error.response?.data || error.message);
    res.status(500).json({ success: false, message: "Payment initialization failed" });
  }
});

// Turn a successful Paystack transaction into tickets. Safe to call many times
// for the same reference: tickets are only ever created once.
const inFlight = new Map();
async function fulfilOrder(paystackData) {
  const reference = paystackData.reference;
  if (inFlight.has(reference)) return inFlight.get(reference);

  const job = (async () => {
    const existing = await Ticket.find({ paymentReference: reference }).lean();
    if (existing.length > 0) return existing;

    const meta = paystackData.metadata || {};
    const event = await Event.findOne({ id: Number(meta.eventId) }).lean();
    const quantity = parseInt(meta.quantity, 10);
    const paidPrice = Number(meta.price);
    if (!event || !meta.userId || !Number.isInteger(quantity) || quantity < 1 || !(paidPrice >= 0)) {
      throw new Error("Payment metadata is invalid");
    }

    const expectedKobo = paidPrice * quantity * 100;
    if (paystackData.amount !== expectedKobo) {
      throw new Error(`Amount mismatch: paid ${paystackData.amount}, expected ${expectedKobo}`);
    }

    return generateTicketsAfterPayment({
      email: String(paystackData.customer?.email || "").toLowerCase(),
      event: { ...event, price: paidPrice },
      quantity,
      attendeeName: meta.attendeeName,
      attendeePhone: meta.attendeePhone,
      paymentReference: reference,
    });
  })();

  inFlight.set(reference, job);
  try {
    return await job;
  } finally {
    inFlight.delete(reference);
  }
}

// Paystack: Verify payment (login required; only the buyer can claim the order)
app.get("/api/pay/verify", requireAuth, async (req, res) => {
  try {
    const reference = req.query.reference || req.query.trxref;
    if (!reference) {
      return res.status(400).json({ success: false, message: "No reference provided" });
    }

    const response = await axios.get(
      `https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`,
      { headers: { Authorization: `Bearer ${PAYSTACK_SECRET_KEY}` } },
    );
    const paystackData = response.data.data;

    if (paystackData.status !== "success") {
      return res.status(400).json({ success: false, message: "Payment verification failed" });
    }

    const buyerEmail = String(paystackData.customer?.email || "").toLowerCase();
    if (buyerEmail !== req.user.email) {
      return res.status(403).json({ success: false, message: "This payment belongs to another account" });
    }

    const tickets = await fulfilOrder(paystackData);
    return res.json({
      success: true,
      message: "Payment verified successfully",
      tickets,
    });
  } catch (error) {
    const statusCode = error.response?.status || 500;
    console.error("Payment verification error:", error.response?.data || error.message);
    return res.status(statusCode).json({
      success: false,
      message: error.response?.data?.message || "Payment verification failed",
    });
  }
});

// Paystack webhook: issues tickets even if the buyer closes the tab after paying
app.post("/api/pay/webhook", async (req, res) => {
  const signature = req.headers["x-paystack-signature"];
  const expected = crypto
    .createHmac("sha512", PAYSTACK_SECRET_KEY)
    .update(req.rawBody || "")
    .digest("hex");

  if (!signature || signature.length !== expected.length ||
      !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
    return res.sendStatus(401);
  }

  res.sendStatus(200); // acknowledge quickly, then do the work
  try {
    if (req.body.event === "charge.success") {
      await fulfilOrder(req.body.data);
    }
  } catch (err) {
    console.error("Webhook fulfilment error:", err.message);
  }
});

// Email one ticket (with its PDF attached) to the attendee
async function emailTicket(ticket, event) {
  const fullName = ticket.attendee.fullName;
  const emailHtml = `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;background:#111;color:#fff;border:1px solid #CC1100">
      <h1 style="text-align:center;color:#E8200C;letter-spacing:2px">YOUR TICKET IS READY</h1>
      <p>Hi ${escapeHtml(fullName)},</p>
      <p>Your ticket for <strong>${escapeHtml(event.title)}</strong> is attached.</p>
      <div style="background:#1b1b1b;padding:15px;border-left:3px solid #CC1100">
        <p><strong>Date:</strong> ${escapeHtml(event.date)}</p>
        <p><strong>Time:</strong> ${escapeHtml(event.time)}</p>
        <p><strong>Venue:</strong> ${escapeHtml(event.location)}</p>
        <p><strong>Ticket type:</strong> ${escapeHtml(String(event.ticketType).toUpperCase())}</p>
        <p><strong>Price:</strong> ${ticket.complimentary ? "Complimentary" : "&#8358;" + Number(event.price).toLocaleString()}</p>
      </div>
      <p>Present the QR code on this ticket at the entrance on the event day.</p>
      <p style="border-top:1px solid #444;padding-top:15px"><strong>Ticket ID:</strong> ${escapeHtml(ticket.ticketId)}</p>
      <p style="color:#999;font-size:12px">Kyomatos - Ride the Wave</p>
    </div>`;

  const filePath = path.join(pdfsDir, path.basename(ticket.pdfFileName));
  if (!fs.existsSync(filePath)) await generateProfessionalPDFTicket(ticket);
  return sendEmail(ticket.attendee.email, `Your ${event.title} Ticket - Kyomatos`, emailHtml, [
    { filename: `${event.title.replace(/\s+/g, "_")}_${ticket.ticketId}.pdf`, path: filePath },
  ]);
}

// Generate tickets (PDF + DB + email). Used for paid orders and for tickets the admin issues.
async function generateTicketsAfterPayment({ email, event, quantity, attendeeName, attendeePhone, paymentReference, complimentary = false, sendEmail: shouldEmail = true }) {
  const tickets = [];

  for (let i = 0; i < quantity; i++) {
    const ticketId = `TKT-${Date.now()}-${crypto.randomBytes(4).toString("hex").toUpperCase()}`;
    const row = String.fromCharCode(65 + Math.floor(Math.random() * 20));
    const seat = String(Math.floor(Math.random() * 100) + 1).padStart(2, "0");
    const gate = Math.floor(Math.random() * 5) + 1;

    const ticket = {
      ticketId,
      eventId: event.id,
      complimentary,
      event: { title: event.title, date: event.date, time: event.time, location: event.location },
      attendee: { fullName: attendeeName || email.split("@")[0], email, phone: attendeePhone || "" },
      ticketDetails: {
        type: event.ticketType,
        price: complimentary ? 0 : event.price,
        seatNumber: `${row}-${seat}`,
        row, seat, gate,
      },
      qrCodeData: signQr(ticketId),
      paymentReference,
      generatedAt: new Date().toISOString(),
      purchasedAt: new Date().toISOString(),
    };

    const pdfResult = await generateProfessionalPDFTicket(ticket);
    ticket.downloadUrl = `/api/tickets/download/${ticketId}`;
    ticket.pdfFileName = pdfResult.fileName;

    await Ticket.create(ticket); // let failures surface so the order can be retried
    if (shouldEmail) await emailTicket(ticket, event);
    tickets.push(ticket);
  }

  return tickets;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

// Download ticket PDF (owner only)
app.get("/api/tickets/download/:ticketId", requireAuth, async (req, res) => {
  try {
    const ticket = await Ticket.findOne({ ticketId: req.params.ticketId }).lean();

    // Same response for "missing" and "not yours" so ids can't be probed
    if (!ticket || String(ticket.attendee.email).toLowerCase() !== req.user.email) {
      return res.status(404).json({ success: false, message: "Ticket not found" });
    }
    if (ticket.cancelledAt) {
      return res.status(410).json({ success: false, message: "This ticket was cancelled" });
    }

    const filePath = path.join(pdfsDir, path.basename(ticket.pdfFileName || ""));
    if (!ticket.pdfFileName || !fs.existsSync(filePath)) {
      // Files on the host's disk can disappear on redeploy: rebuild the PDF
      await generateProfessionalPDFTicket(ticket);
    }
    res.download(filePath, `kyomatos_ticket_${ticket.ticketId}.pdf`);
  } catch (err) {
    console.error("Ticket download error:", err.message);
    res.status(500).json({ success: false, message: "Could not download ticket" });
  }
});

// QR code image for a ticket (owner only). Generated here so ticket codes never go to a third-party service.
app.get("/api/tickets/:ticketId/qr", requireAuth, async (req, res) => {
  try {
    const ticket = await Ticket.findOne({ ticketId: req.params.ticketId }).lean();
    if (!ticket || String(ticket.attendee.email).toLowerCase() !== req.user.email) {
      return res.status(404).json({ success: false, message: "Ticket not found" });
    }
    if (ticket.cancelledAt) {
      return res.status(410).json({ success: false, message: "This ticket was cancelled" });
    }
    res.set("Content-Type", "image/png");
    res.set("Cache-Control", "private, max-age=3600");
    res.send(QRCode.imageSync(signQr(ticket.ticketId), { type: "png", size: 8, margin: 2 }));
  } catch (err) {
    console.error("QR error:", err.message);
    res.status(500).json({ success: false, message: "Could not create QR code" });
  }
});

// Gate check-in: scan a QR code, mark the ticket used. Staff only (ADMIN_KEY header).
// A ticket can be checked in once; a second scan is rejected.
app.post("/api/checkin", rateLimit({ windowMs: 60 * 1000, max: 120 }), async (req, res) => {
  const adminKey = process.env.ADMIN_KEY;
  const given = String(req.headers["x-admin-key"] || "");
  const keyOk = adminKey && given.length === adminKey.length &&
    crypto.timingSafeEqual(Buffer.from(given), Buffer.from(adminKey));
  if (!keyOk) {
    return res.status(401).json({ success: false, message: "Not authorised" });
  }

  try {
    const ticketId = verifyQr(req.body.code);
    if (!ticketId) {
      return res.status(400).json({ success: false, valid: false, message: "Invalid ticket code" });
    }

    // Atomic: only the first scan can flip checkedInAt from null
    const ticket = await Ticket.findOneAndUpdate(
      { ticketId, checkedInAt: null, cancelledAt: null },
      { checkedInAt: new Date() },
      { new: true },
    ).lean();

    if (ticket) {
      return res.json({
        success: true, valid: true, message: "Welcome in!",
        ticket: { ticketId, event: ticket.event.title, attendee: ticket.attendee.fullName, type: ticket.ticketDetails.type },
      });
    }

    const used = await Ticket.findOne({ ticketId }).lean();
    if (!used) return res.status(404).json({ success: false, valid: false, message: "Ticket not found" });
    if (used.cancelledAt) {
      return res.status(410).json({ success: false, valid: false, message: "Ticket was cancelled" });
    }
    return res.status(409).json({
      success: false, valid: true, message: "Ticket already used",
      checkedInAt: used.checkedInAt,
    });
  } catch (err) {
    console.error("Check-in error:", err.message);
    res.status(500).json({ success: false, message: "Check-in failed" });
  }
});

// Get the logged-in user's tickets
app.get("/api/tickets/user", requireAuth, async (req, res) => {
  try {
    const tickets = await Ticket.find({ "attendee.email": req.user.email })
      .sort({ purchasedAt: -1 })
      .lean();
    res.json({ success: true, tickets, count: tickets.length });
  } catch (err) {
    console.error("Ticket history lookup error:", err.message);
    res.status(500).json({ success: false, message: "Could not load tickets" });
  }
});

// Public: events currently on sale
const publicEvent = (e, sold) => ({
  id: e.id, title: e.title, date: e.date, time: e.time, location: e.location, venueAddress: e.venueAddress,
  description: e.description, image: e.image, price: e.price, ticketType: e.ticketType,
  soldOut: e.capacity != null && sold >= e.capacity,
});

async function soldCounts() {
  const rows = await Ticket.aggregate([
    { $match: { cancelledAt: null } },
    { $group: { _id: "$eventId", n: { $sum: 1 } } },
  ]);
  return Object.fromEntries(rows.map((r) => [r._id, r.n]));
}

app.get("/api/events", async (req, res) => {
  try {
    const [events, counts] = await Promise.all([
      Event.find({ active: true, deleted: { $ne: true } }).sort({ id: 1 }).lean(),
      soldCounts(),
    ]);
    res.set("Cache-Control", "public, max-age=30");
    res.json({ success: true, events: events.map((e) => publicEvent(e, counts[e.id] || 0)) });
  } catch (err) {
    console.error("Events list error:", err.message);
    res.status(500).json({ success: false, message: "Could not load events" });
  }
});

app.get("/api/events/:id", async (req, res) => {
  try {
    const e = await Event.findOne({ id: Number(req.params.id), active: true, deleted: { $ne: true } }).lean();
    if (!e) return res.status(404).json({ success: false, message: "Event not found" });
    const counts = await soldCounts();
    res.json({ success: true, event: publicEvent(e, counts[e.id] || 0) });
  } catch (err) {
    res.status(500).json({ success: false, message: "Could not load event" });
  }
});

// Admin area (ADMIN_KEY protected)
app.use("/api/admin", createAdminRouter({ generateTicketsAfterPayment, emailTicket, generateProfessionalPDFTicket }));

// Health check
app.get("/health", (req, res) => {
  res.json({
    status: "healthy",
    service: "kyomatos-ticket-backend",
    features: [
      "Paystack Payments",
      "Professional PDF Tickets",
      "QR Codes",
      "Barcodes",
    ],
  });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(
    `💰 Paystack Integration: ${PAYSTACK_SECRET_KEY ? "Ready" : "Test Mode"}`,
  );
  console.log(`🎫 Professional Ticket Design: Enabled`);
});
