const express = require("express");
require("dotenv").config();
const router = express.Router();
const Groq = require("groq-sdk");
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
const jwt = require("jsonwebtoken");
const User = require("./model/user");

// ─── Auth middleware (inline, same pattern as your existing routes) ───────────
const auth = (req, res, next) => {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ error: "No token" });
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: "Invalid token" });
  }
};

// ─── POST /recommend ──────────────────────────────────────────────────────────
router.post("/recommend", auth, async (req, res) => {
  const { city, userLat, userLng, radius, vibes } = req.body;

  console.log("Recommend request:", { city, userLat, userLng, radius, vibes });

  if (!city || !vibes || vibes.length === 0) {
    return res.status(400).json({ error: "City and vibes are required" });
  }

  // ── Pull user's interaction history for personalisation ──────────────────
  let personalisationContext = "";
  try {
    const user = await User.findById(req.user.userId).select("interactions saved_places vibe_history");
    if (user) {
      const topSaved = user.interactions
        .filter(i => i.rating === 5)
        .slice(-10)
        .map(i => i.name);

      const topVibes = user.vibe_history.slice(-5);

      if (topSaved.length > 0) {
        personalisationContext += `\nThe user has previously saved these places, so recommend similar ones: ${topSaved.join(", ")}.`;
      }
      if (topVibes.length > 0) {
        personalisationContext += `\nThe user's recent preferred vibes are: ${topVibes.join(", ")}.`;
      }
    }
  } catch (err) {
    console.warn("Could not fetch user history for personalisation:", err.message);
    // Non-fatal — continue without personalisation
  }

  const prompt = `
You are a travel recommendation assistant.
The user is currently at coordinates: latitude ${userLat}, longitude ${userLng}, in the city of ${city}.
Suggest exactly 5 real, well-known places to visit within ${radius} km of the user's location.
These places must match the following vibes: ${vibes.join(", ")}.
${personalisationContext}

Return ONLY a raw JSON array. No markdown. No code blocks. No explanation. Just the JSON array.
Each object must have exactly these keys:
- "name": string (real place name)
- "description": string (1-2 sentences about the place)
- "rating": number (real-world rating out of 5, e.g. 4.3)
- "fare": number (estimated one-way cab fare in INR from user location as a plain number)
- "latitude": number (real latitude of the place)
- "longitude": number (real longitude of the place)

Example format (use real data, do not copy these values):
[{"name":"Gateway of India","description":"Iconic arch monument on the Mumbai waterfront built in 1924.","rating":4.6,"fare":120,"latitude":18.9220,"longitude":72.8347}]
`;

  try {
    const completion = await groq.chat.completions.create({
      model: "llama-3.1-8b-instant",
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
    });

    const textOutput = completion.choices[0].message.content;
    console.log("Raw Groq output:", textOutput);

    if (!textOutput) {
      return res.status(500).json({ error: "No output from Groq" });
    }

    let data;
    try {
      const cleaned = textOutput.replace(/```json|```|`/g, "").trim();
      const parsed = JSON.parse(cleaned);
      data = Array.isArray(parsed) ? parsed : (parsed.places || parsed.recommendations || Object.values(parsed)[0]);

      // Calculate real distance using Haversine formula
      data = data.map(place => {
        const R = 6371;
        const dLat = ((place.latitude - userLat) * Math.PI) / 180;
        const dLng = ((place.longitude - userLng) * Math.PI) / 180;
        const a =
          Math.sin(dLat / 2) * Math.sin(dLat / 2) +
          Math.cos((userLat * Math.PI) / 180) *
          Math.cos((place.latitude * Math.PI) / 180) *
          Math.sin(dLng / 2) * Math.sin(dLng / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        const distance = (R * c).toFixed(1);
        return { ...place, distance };
      }).filter(place => parseFloat(place.distance) <= parseFloat(radius));

      console.log("Parsed + enriched data:", data);
    } catch (err) {
      console.error("Failed to parse Groq JSON:", err, textOutput);
      return res.status(500).json({ error: "Invalid JSON from Groq API" });
    }

    res.json(data);
  } catch (err) {
    console.error("Groq API error:", err);
    res.status(500).json({ error: "Failed to fetch recommendations" });
  }
});

// ─── POST /interact — logs saves (rating:5) and map opens (rating:3) ─────────
router.post("/interact", auth, async (req, res) => {
  const { name, description, city, vibe, latitude, longitude, fare, distance, action } = req.body;

  if (!name || !action) {
    return res.status(400).json({ error: "name and action are required" });
  }

  if (!["saved", "map_opened", "itinerary_selected"].includes(action)) {
     return res.status(400).json({ error: "action must be 'saved', 'map_opened', or 'itinerary_selected'" });
  }

  const rating = action === "saved" ? 5 : action === "itinerary_selected" ? 4 : 3;
  try {
    const user = await User.findById(req.user.userId);
    if (!user) return res.status(404).json({ error: "User not found" });

    // Always push to interactions[]
    user.interactions.push({
      name,
      city:      city || "",
      vibe:      vibe || "",
      rating,
      latitude,
      longitude,
      action,
      timestamp: new Date()
    });

    // If saved → also push to saved_places[] and update vibe_history
    if (action === "saved") {
      user.saved_places.push({
        name,
        description: description || "",
        distance:    distance || "",
        mapUrl: `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`,
        vibe:        vibe || "",
        saved_at:    new Date()
      });

      if (vibe && !user.vibe_history.includes(vibe)) {
        user.vibe_history.push(vibe);
      }
    }

    await user.save();
    res.json({ success: true, action, rating });

  } catch (err) {
    console.error("Interact error:", err);
    res.status(500).json({ error: "Failed to log interaction" });
  }
});

// ─── GET /trending — top 10 most-saved places across all users ───────────────
router.get("/trending", async (req, res) => {
  try {
    const trending = await User.aggregate([
      { $unwind: "$interactions" },
      { $match: { "interactions.action": "saved" } },
      {
        $group: {
          _id:          "$interactions.name",
          save_count:   { $sum: 1 },
          city:         { $first: "$interactions.city" },
          vibe:         { $first: "$interactions.vibe" },
          latitude:     { $first: "$interactions.latitude" },
          longitude:    { $first: "$interactions.longitude" },
        }
      },
      { $sort: { save_count: -1 } },
      { $limit: 10 },
      {
        $project: {
          _id: 0,
          name:       "$_id",
          save_count: 1,
          city:       1,
          vibe:       1,
          latitude:   1,
          longitude:  1,
        }
      }
    ]);

    res.json(trending);
  } catch (err) {
    console.error("Trending error:", err);
    res.status(500).json({ error: "Failed to fetch trending places" });
  }
});

module.exports = router;