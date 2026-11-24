const mongoose = require("mongoose");

const eventSchema = new mongoose.Schema({
    id: { type: Number, required: true, unique: true, index: true }, // public numeric id used in URLs
    title: { type: String, required: true, trim: true },
    date: { type: String, default: "" },      // text shown to customers, e.g. "December 5, 2025"
    dateISO: { type: String, default: "" },   // YYYY-MM-DD from the admin date picker (optional)
    time: { type: String, default: "" },
    location: { type: String, default: "" },
    venueAddress: { type: String, default: "" },
    description: { type: String, default: "" },
    image: { type: String, default: "" },     // https URL or images/xyz.jpg
    price: { type: Number, required: true, min: 0 }, // naira
    organizer: { type: String, default: "" },   // whose event this is (for payouts)
    serviceFee: { type: Number, default: 500, min: 0 }, // Kyomatos fee per ticket, paid by the buyer on top of the price
    ticketType: { type: String, default: "standard" },
    capacity: { type: Number, default: null }, // null = unlimited
    active: { type: Boolean, default: true },  // false = sales closed / hidden from the site
    deleted: { type: Boolean, default: false }, // "removed": hidden everywhere but old tickets keep working
}, { timestamps: true });

module.exports = mongoose.model("Event", eventSchema);