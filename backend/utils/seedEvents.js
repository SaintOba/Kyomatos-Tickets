const Event = require("../models/Event");
const SEED = require("../data/events");

const IMAGES = {
  1: "images/tech.jpg", 2: "images/festiival.jpg", 3: "images/art.jpg",
  4: "images/afro6.jpg", 5: "images/poolparty.jpg", 6: "images/kickback.jpg",
};
const DESCRIPTIONS = {
  1: "Join the biggest tech conference with industry leaders, workshops, and networking opportunities.",
  2: "Experience live performances from top artists at the annual music festival.",
  3: "Explore contemporary art from local to international artists.",
  4: "Exclusive Afrobeat party with top DJs and artists.",
  5: "Summer pool party with music, drinks, and entertainment.",
  6: "Exclusive house party with premium amenities.",
};

// First start only: copy the built-in events into the database so the site isn't empty.
module.exports = async function seedEvents() {
  try {
    if ((await Event.countDocuments({})) > 0) return;
    for (const e of Object.values(SEED)) {
      await Event.create({ ...e, image: IMAGES[e.id] || "", description: DESCRIPTIONS[e.id] || "" });
    }
    console.log("Seeded events into the database");
  } catch (err) {
    console.error("Event seeding failed:", err.message);
  }
};
