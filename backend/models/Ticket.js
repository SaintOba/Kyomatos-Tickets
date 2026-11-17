const mongoose = require("mongoose");

const ticketSchema = new mongoose.Schema({
    ticketId: { type: String, required: true, unique: true, index: true },
    event: {
        title: String,
        date: String,
        time: String,
        location: String,
    },
    attendee: {
        fullName: String,
        email: { type: String, required: true, index: true },
        phone: String,
    },
    ticketDetails: {
        type: { type: String },
        price: Number,
        seatNumber: String,
        row: String,
        seat: String,
        gate: Number,
    },
    qrCodeData: String,
    downloadUrl: String,
    pdfFileName: String,
    paymentReference: String,
    checkedInAt: { type: Date, default: null },
    generatedAt: { type: Date, default: Date.now },
    purchasedAt: { type: Date, default: Date.now },
}, { timestamps: true });

module.exports = mongoose.model("Ticket", ticketSchema);
