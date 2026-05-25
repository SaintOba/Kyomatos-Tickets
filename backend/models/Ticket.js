const mongoose = require("mongoose");

const ticketSchema = new mongoose.Schema({
    eventId: Number,
    eventTitle: String,
    buyerEmail: String,
    amount: Number,
    ticketCode: String,
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model("Ticket", ticketSchema);
