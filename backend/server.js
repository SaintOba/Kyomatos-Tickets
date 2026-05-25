const express = require("express");
const cors = require("cors");
const path = require("path");
const fs = require("fs");
const PDFDocument = require("pdfkit");
const QRCode = require("qr-image");
const axios = require("axios");
const sendEmail = require("./utils/sendEmail");
require("dotenv").config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use("/pdfs", express.static(path.join(__dirname, "pdfs")));

// Serve frontend files
app.use(express.static(path.join(__dirname, "..")));

// Store tickets in memory
let generatedTickets = [];
let pendingPayments = new Map();

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
      leftGradient.stop(0, "#8B2FBE");
      leftGradient.stop(1, "#6A0DAD");
      doc.rect(0, 0, 280, 380).fill(leftGradient);

      // Decorative elements and event name
      doc
        .fillColor("#ffffff")
        .fontSize(18)
        .font("Helvetica")
        .text("🎤 🎵 🎸", 10, 30, { width: 260, align: "center" });

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
        .text("🎸 🎵 🎤", 10, 180, { width: 260, align: "center" });

      // Ticket type badge
      doc
        .strokeColor("#C724B1")
        .lineWidth(2)
        .rect(30, 240, 220, 35)
        .stroke();
      doc
        .fillColor("#C724B1")
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
        .strokeColor("rgba(123, 47, 190, 0.3)")
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
        .strokeColor("rgba(123, 47, 190, 0.3)")
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
        .strokeColor("#7B2FBE")
        .lineWidth(2)
        .rect(detailsX, pillsY, pillWidth, pillHeight)
        .stroke();
      doc
        .fillColor("rgba(123, 47, 190, 0.15)")
        .rect(detailsX, pillsY, pillWidth, pillHeight)
        .fill();

      doc
        .fillColor("#b0b0b0")
        .fontSize(8)
        .font("Helvetica-Bold")
        .text("ROW", detailsX + 5, pillsY + 8, { width: pillWidth - 10, align: "center" });

      const rowLetter = String.fromCharCode(65 + Math.floor(Math.random() * 20));
      doc
        .fillColor("#C724B1")
        .fontSize(18)
        .font("Helvetica-Bold")
        .text(rowLetter, detailsX + 5, pillsY + 25, { width: pillWidth - 10, align: "center" });

      // SEAT Pill
      doc
        .strokeColor("#7B2FBE")
        .lineWidth(2)
        .rect(detailsX + pillWidth + pillGap, pillsY, pillWidth, pillHeight)
        .stroke();
      doc
        .fillColor("rgba(123, 47, 190, 0.15)")
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

      const seatNumber = String(Math.floor(Math.random() * 100) + 1).padStart(2, "0");
      doc
        .fillColor("#C724B1")
        .fontSize(18)
        .font("Helvetica-Bold")
        .text(seatNumber, detailsX + pillWidth + pillGap + 5, pillsY + 25, {
          width: pillWidth - 10,
          align: "center",
        });

      // GATE Pill
      doc
        .strokeColor("#7B2FBE")
        .lineWidth(2)
        .rect(detailsX + 2 * (pillWidth + pillGap), pillsY, pillWidth, pillHeight)
        .stroke();
      doc
        .fillColor("rgba(123, 47, 190, 0.15)")
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

      const gateNumber = Math.floor(Math.random() * 5) + 1;
      doc
        .fillColor("#C724B1")
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
        .strokeColor("#C724B1")
        .lineWidth(3)
        .circle(priceX, priceY, priceRadius)
        .stroke();

      doc
        .fillColor("#7B2FBE")
        .opacity(0.2)
        .circle(priceX, priceY, priceRadius)
        .fill();
      doc.opacity(1);

      // Price text
      doc
        .fillColor("#ffffff")
        .fontSize(18)
        .font("Helvetica-Bold")
        .text("₦", priceX - 20, priceY - 28);

      doc
        .fillColor("#ffffff")
        .fontSize(24)
        .font("Helvetica-Bold")
        .text((ticket.ticketDetails.price / 1000).toFixed(0) + "K", priceX - 30, priceY - 8);

      // ===== PERFORATED DIVIDER =====
      doc
        .strokeColor("#C724B1")
        .lineWidth(2)
        .dash(10, { space: 10 })
        .moveTo(780, 0)
        .lineTo(780, 380)
        .stroke();
      doc.undash();

      // Scissors emoji
      doc
        .fontSize(20)
        .font("Helvetica")
        .text("✂️", 765, 175);

      // ===== RIGHT SECTION - QR Code & ADMIT ONE =====
      doc.fillColor("#0d0d0d").rect(780, 0, 320, 380).fill();

      // QR Code background
      doc
        .fillColor("#ffffff")
        .rect(830, 50, 180, 180)
        .fill();

      // QR Code
      const qrData = `KYOMATOS:${ticket.ticketId}:${ticket.attendee.email}:${ticket.event.title}`;
      const qrImage = QRCode.imageSync(qrData, { type: "png", size: 10 });

      if (qrImage) {
        doc.image(qrImage, 840, 60, {
          width: 160,
          height: 160,
        });
      }

      // ADMIT ONE text
      doc
        .fillColor("#C724B1")
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

// Paystack: Initialize payment
app.post("/api/pay/initialize", async (req, res) => {
  try {
    const { email, amount, eventId, quantity, metadata } = req.body;

    const callbackUrl = `${FRONTEND_URL}/about.html?id=${encodeURIComponent(eventId)}`;

    const response = await axios.post(
      "https://api.paystack.co/transaction/initialize",
      {
        email,
        amount: amount * 100, // Convert to kobo
        callback_url: callbackUrl,
        metadata: {
          eventId,
          quantity,
          ...metadata,
        },
      },
      {
        headers: {
          Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
          "Content-Type": "application/json",
        },
      },
    );

    // Store payment reference for verification
    const reference = response.data.data.reference;
    pendingPayments.set(reference, {
      email,
      amount,
      eventId,
      quantity,
      metadata,
      createdAt: new Date(),
    });

    res.json({
      success: true,
      message: "Payment initialized",
      data: {
        authorization_url: response.data.data.authorization_url,
        access_code: response.data.data.access_code,
        reference: response.data.data.reference,
        publicKey: PAYSTACK_PUBLIC_KEY,
      },
    });
  } catch (error) {
    console.error(
      "Paystack initialization error:",
      error.response?.data || error.message,
    );
    res.status(500).json({
      success: false,
      message: "Payment initialization failed",
      error: error.response?.data?.message || error.message,
    });
  }
});

// Paystack: Verify payment
app.get("/api/pay/verify", async (req, res) => {
  try {
    const { reference } = req.query;

    if (!reference) {
      return res.status(400).json({
        success: false,
        message: "No reference provided",
      });
    }

    const response = await axios.get(
      `https://api.paystack.co/transaction/verify/${reference}`,
      {
        headers: {
          Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
        },
      },
    );

    if (response.data.data.status === "success") {
      const paymentData = pendingPayments.get(reference);

      if (paymentData) {
        const tickets = await generateTicketsAfterPayment(paymentData);
        pendingPayments.delete(reference);

        res.json({
          success: true,
          message: "Payment verified successfully",
          payment: response.data.data,
          tickets: tickets,
        });
      } else {
        res.status(400).json({
          success: false,
          message: "Payment data not found",
        });
      }
    } else {
      res.status(400).json({
        success: false,
        message: "Payment verification failed",
      });
    }
  } catch (error) {
    console.error("Payment verification error:", error);
    res.status(500).json({
      success: false,
      message: "Payment verification failed",
      error: error.response?.data?.message || error.message,
    });
  }
});

// Generate tickets after payment
async function generateTicketsAfterPayment(paymentData) {
  const { email, amount, eventId, quantity, metadata } = paymentData;

  // In real app, fetch event details from database
  const eventDetails = {
    title: metadata.eventTitle || "Event",
    date: metadata.eventDate || "2025-12-31",
    time: metadata.eventTime || "08:00 PM",
    location: metadata.eventLocation || "Venue",
    ticketType: metadata.ticketType || "standard",
    price: amount / quantity,
  };

  const tickets = [];

  for (let i = 0; i < quantity; i++) {
    const ticketId = `TKT-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;

    const ticket = {
      ticketId,
      event: {
        title: eventDetails.title,
        date: eventDetails.date,
        time: eventDetails.time,
        location: eventDetails.location,
      },
      attendee: {
        fullName: metadata.attendeeName || email.split("@")[0],
        email: email,
        phone: metadata.attendeePhone || "",
      },
      ticketDetails: {
        type: eventDetails.ticketType,
        price: eventDetails.price,
        seatNumber: `SEAT-${Math.floor(Math.random() * 1000)}`,
      },
      qrCodeData: `KYOMATOS:${ticketId}:${email}`,
      paymentReference: metadata.paymentReference,
      generatedAt: new Date().toISOString(),
      purchasedAt: new Date().toISOString(),
    };

    // Generate PDF ticket
    const pdfResult = await generateProfessionalPDFTicket(ticket);
    ticket.downloadUrl = pdfResult.url;
    ticket.pdfFileName = pdfResult.fileName;

    // Send ticket via email
    const emailHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: 'Inter', sans-serif; background: #0d0d0d; color: #ffffff; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; background: #1a1a1a; border-radius: 15px; border: 1px solid rgba(123, 47, 190, 0.2); }
            .header { text-align: center; margin-bottom: 30px; }
            .header h1 { background: linear-gradient(135deg, #7B2FBE 0%, #C724B1 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; font-size: 2.5rem; margin: 0; }
            .content { color: #b0b0b0; line-height: 1.6; }
            .event-details { background: rgba(123, 47, 190, 0.1); padding: 15px; border-radius: 8px; margin: 20px 0; }
            .event-details p { margin: 8px 0; }
            .download-btn { display: inline-block; background: linear-gradient(135deg, #7B2FBE 0%, #C724B1 100%); color: white; padding: 12px 30px; border-radius: 25px; text-decoration: none; margin-top: 20px; font-weight: 600; }
            .footer { text-align: center; margin-top: 30px; color: #7B2FBE; font-size: 0.9rem; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Your Ticket is Ready! 🎉</h1>
            </div>
            <div class="content">
              <p>Hi ${ticket.attendee.fullName},</p>
              <p>Thank you for your purchase! Your ticket for <strong>${eventDetails.title}</strong> is ready.</p>
              
              <div class="event-details">
                <p><strong>📅 Event Date:</strong> ${eventDetails.date}</p>
                <p><strong>⏰ Time:</strong> ${eventDetails.time}</p>
                <p><strong>📍 Venue:</strong> ${eventDetails.location}</p>
                <p><strong>🎫 Ticket Type:</strong> ${eventDetails.ticketType.toUpperCase()}</p>
                <p><strong>💰 Price:</strong> ₦${eventDetails.price.toLocaleString()}</p>
              </div>
              
              <p>Your ticket has been attached to this email. You can also download it from your account on Kyomatos.</p>
              <p>Please present your ticket at the entrance on the event day.</p>
              
              <p style="margin-top: 30px; padding-top: 20px; border-top: 1px solid rgba(123, 47, 190, 0.2);">
                <strong>Ticket ID:</strong> ${ticket.ticketId}
              </p>
            </div>
            <div class="footer">
              <p>Kyomatos - Your Event Ticketing Platform</p>
              <p>Questions? Contact us at support@kyomatos.com</p>
            </div>
          </div>
        </body>
      </html>
    `;

    // Send email with attachment
    const filePath = path.join(pdfsDir, pdfResult.fileName);
    await sendEmail(email, `Your ${eventDetails.title} Ticket - Kyomatos`, emailHtml, [
      {
        filename: `${eventDetails.title.replace(/\s+/g, "_")}_${ticket.ticketId}.pdf`,
        path: filePath,
      },
    ]);

    tickets.push(ticket);
    generatedTickets.push(ticket);
  }

  return tickets;
}

// Generate ticket endpoint (for testing without payment)
app.post("/api/tickets/generate", async (req, res) => {
  try {
    const { event, attendee, quantity = 1 } = req.body;

    const tickets = [];

    for (let i = 0; i < quantity; i++) {
      const ticketId = `TKT-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;

      const ticket = {
        ticketId,
        event: {
          title: event.title,
          date: event.date,
          time: event.time,
          location: event.location,
        },
        attendee: {
          fullName: attendee.fullName,
          email: attendee.email,
          phone: attendee.phone || "",
        },
        ticketDetails: {
          type: event.ticketType || "standard",
          price: event.price || 0,
        },
        qrCodeData: `KYOMATOS:${ticketId}:${attendee.email}`,
        generatedAt: new Date().toISOString(),
      };

      const pdfResult = await generateProfessionalPDFTicket(ticket);
      ticket.downloadUrl = pdfResult.url;
      ticket.pdfFileName = pdfResult.fileName;

      tickets.push(ticket);
      generatedTickets.push(ticket);
    }

    res.json({
      success: true,
      message: `Successfully generated ${tickets.length} ticket(s)`,
      tickets,
      summary: {
        totalAmount: (event.price || 0) * quantity,
        quantity,
      },
    });
  } catch (error) {
    console.error("Ticket generation error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
});

// Download ticket PDF
app.get("/api/tickets/download/:ticketId", (req, res) => {
  const { ticketId } = req.params;
  const ticket = generatedTickets.find((t) => t.ticketId === ticketId);

  if (!ticket) {
    return res.status(404).json({
      success: false,
      message: "Ticket not found",
    });
  }

  const filePath = path.join(pdfsDir, ticket.pdfFileName);

  if (!fs.existsSync(filePath)) {
    return res.status(404).json({
      success: false,
      message: "PDF file not found",
    });
  }

  res.download(filePath, `kyomatos_ticket_${ticketId}.pdf`);
});

// Get user tickets
app.get("/api/tickets/user/:email", (req, res) => {
  const { email } = req.params;
  const userTickets = generatedTickets.filter(
    (t) => t.attendee.email === email,
  );

  res.json({
    success: true,
    tickets: userTickets,
    count: userTickets.length,
  });
});

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
// Add to server.js after other requires:
const authRoutes = require("./routes/auth");

// Add before other routes:
app.use("/api/auth", authRoutes);
