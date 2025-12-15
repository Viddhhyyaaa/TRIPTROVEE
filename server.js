const express = require("express");
const path = require("path");
const mongoose = require("mongoose");
const dotenv = require("dotenv");
const User = require("./model/user");
const cors = require("cors");
// Using built-in fetch (Node 18+)

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// MongoDB Connection
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("✅ Connected to MongoDB"))
  .catch((err) => console.error("❌ MongoDB connection error:", err));

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));

// Root route
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

//
// 🌍 RECOMMENDATIONS — JSON-safe Gemini integration
//
app.post("/recommendations", async (req, res) => {
  try {
    const { city, vibe, visited = [], bookmarked = [], selected = [],  userLocation, } = req.body;

    if (!city || !vibe) {
      return res.status(400).json({ error: "City and vibe are required." });
    }
    if (
      !userLocation ||
      typeof userLocation.lat !== "number" ||
      typeof userLocation.lng !== "number"
    ) {
      return res
        .status(400)
        .json({ error: "User current location is required." });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    const MODEL = "gemini-2.5-flash";

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

    // 🔒 STRICT JSON-ONLY PROMPT
    const prompt = `
You are a strict JSON API.

Return ONLY valid JSON.
NO markdown.
NO explanation.
NO extra text.

Return EXACTLY 4 places in this format:

[
  {
    "name": "Place name",
    "description": "1–2 sentence description",
    "latitude": number,
    "longitude": number
  }
]

Rules:
- City: ${city}
- Vibe: ${vibe}
- Exclude visited: ${visited.join(", ") || "None"}
- Exclude selected: ${selected.join(", ") || "None"}
- If bookmarked exists, include 1 or 2: ${bookmarked.join(", ") || "None"}

Return ONLY the JSON array.
`;

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: {
        temperature: 0.4,
        maxOutputTokens: 1200,
        responseMimeType: "application/json"
        },
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Gemini API error ${response.status}: ${text}`);
    }

    const result = await response.json();
    const rawText =
      result?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!rawText) {
      throw new Error("Empty Gemini response");
    }

    // 🧠 PARSE JSON SAFELY
    let places;
    try {
      places = JSON.parse(rawText);
    } catch (err) {
      console.error("Invalid JSON from Gemini:", rawText);
      throw new Error("Gemini returned invalid JSON");
    }

    // 🛡 VALIDATION (hard guarantee)
    if (!Array.isArray(places) || places.length !== 4) {
      throw new Error("Gemini did not return exactly 4 places");
    }
      function getDistanceKm(lat1, lon1, lat2, lon2) {
      const R = 6371;
      const dLat = ((lat2 - lat1) * Math.PI) / 180;
      const dLon = ((lon2 - lon1) * Math.PI) / 180;

      const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos((lat1 * Math.PI) / 180) *
          Math.cos((lat2 * Math.PI) / 180) *
          Math.sin(dLon / 2) ** 2;

      return (R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))).toFixed(2);
    }

    const { lat: userLat, lng: userLng } = userLocation;

    // 📍 ADD COORDS + MAP LINKS
    const enrichedPlaces = places.map((p) => {
      const lat = 12.9716 + (Math.random() * 0.2 - 0.1);
      const lng = 77.5946 + (Math.random() * 0.2 - 0.1);

      return {
        ...p,
        coordinates: `${lat},${lng}`,
        mapUrl: `https://www.google.com/maps/search/${encodeURIComponent(
          p.name
        )}+${encodeURIComponent(city)}`,
      };
    });

    return res.json(enrichedPlaces);

  } catch (err) {
    console.error("Recommendations error:", err.message);

    // 🔁 SAFE FALLBACK (only if Gemini truly fails)
    return res.status(500).json({
      error: "Failed to generate recommendations",
    });
  }
});


//
// 👤 USER SIGNUP
//
app.post("/signup", async (req, res) => {
  try {
    const { username, email, password } = req.body;

    if (!username || !email || !password)
      return res.status(400).json({ message: "All fields are required" });
    if (password.length < 6)
      return res.status(400).json({ message: "Password must be at least 6 characters long" });

    const existingUser = await User.findOne({ $or: [{ email }, { username }] });
    if (existingUser) {
      return res.status(400).json({
        message:
          existingUser.email === email
            ? "Email already exists"
            : "Username already exists",
      });
    }

    const newUser = new User({ username, email, password });
    await newUser.save();

    res.status(201).json({
      message: "User registered successfully",
      user: { id: newUser._id, username: newUser.username, email: newUser.email },
    });
  } catch (err) {
    console.error("Signup error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

//
// 🔐 USER LOGIN
//
app.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password)
      return res.status(400).json({ message: "Email and password are required" });

    const user = await User.findOne({ email });
    if (!user) return res.status(401).json({ message: "Invalid credentials" });

    const isMatch = await user.comparePassword(password);
    if (!isMatch) return res.status(401).json({ message: "Invalid credentials" });

    res.status(200).json({
      message: "Login successful",
      user: { id: user._id, username: user.username, email: user.email },
    });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

//
// 🚀 SERVER START
//
app.listen(PORT, () => {
  console.log(`✅ Triptrove is live at: http://localhost:${PORT}`);
});

//
// 🌎 NEW ROUTE: /recommend — JSON-based Gemini response
//
app.post("/recommend", async (req, res) => {
  try {
    const { city, radius = 10, vibes = [] } = req.body;

    if (!city || !Array.isArray(vibes) || vibes.length === 0) {
      return res.status(400).json({ error: "City and vibes are required" });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error("Missing GEMINI_API_KEY");

    const MODEL = "gemini-2.5-flash";
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${apiKey}`;

    // 🔒 STRICT JSON PROMPT
    const prompt = `
You are a strict JSON API.

Return ONLY valid JSON.
NO markdown.
NO explanation.
NO text outside JSON.

Return an array of 6 to 8 objects in this exact format:

[
  {
    "name": "string",
    "description": "string",
    "distance": "number (km)",
    "fare": "number",
    "rating": "number",
    "latitude": "number",
    "longitude": "number"
  }
]

Rules:
- City: ${city}
- Radius: ${radius} km
- Vibes: ${vibes.join(", ")}

Return ONLY the JSON array.
`;

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.5,
          maxOutputTokens: 1500,
          responseMimeType: "application/json"
        }
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Gemini API error ${response.status}: ${text}`);
    }

    const result = await response.json();
    const rawText = result?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!rawText) throw new Error("Empty Gemini response");

    let places;
    try {
      places = JSON.parse(rawText);
    } catch (err) {
      console.error("Invalid JSON from Gemini:", rawText);
      throw new Error("Gemini returned malformed JSON");
    }

    if (!Array.isArray(places) || places.length < 6) {
      throw new Error("Gemini returned insufficient places");
    }

    res.json(places);

  } catch (err) {
    console.error("💥 /recommend error:", err.message);
    res.status(500).json({ error: "Failed to generate recommendations" });
  }
});
