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
// 🌍 RECOMMENDATIONS (Day Planner logic — your original code)
//
app.post("/recommendations", async (req, res) => {
  try {
    const { city, vibe, visited = [], bookmarked = [], selected = [] } = req.body;

    if (!city || !vibe) {
      return res.status(400).json({ error: "City and vibe are required." });
    }

    const apiKey = process.env.GEMINI_API_KEY || "AIzaSyDdnwlDs0ZUeL6T0wUZJ0HMu8aMJm27ohI";
    const modelName = process.env.GEMINI_MODEL || "gemini-2.5-flash";
    const url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent";


    const prompt = `
Recommend exactly 4 unique ${vibe} places in ${city}.
Requirements:
- Each place on a separate line.
- Format: Name | 1-2 sentence description | Distance from city center.
- Do NOT repeat places already visited (${visited.join(", ")}) or recently selected (${selected.join(", ")}).
- If bookmarked places exist (${bookmarked.join(", ")}), include 1-2 of them.
- Provide ONLY the 4 lines. No bullets, no extra text.
`;

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.5,
          maxOutputTokens: 600,
          candidateCount: 1,
        },
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Gemini API error: ${response.status} - ${text}`);
    }

    const result = await response.json();
    const content = result?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();

    const places = [];

    if (content) {
      const lines = content.split(/\r?\n/).map(l => l.trim()).filter(Boolean);

      for (const line of lines) {
        if (!line.includes("|")) continue;

        const [nameRaw, descRaw, distRaw] = line.split("|");
        const name = nameRaw?.trim();
        const description = descRaw?.trim();
        const distance = distRaw?.trim();

        if (name && description && distance) {
          const lat = 12.9716 + (Math.random() * 0.2 - 0.1);
          const lng = 77.5946 + (Math.random() * 0.2 - 0.1);
          places.push({
            name,
            description,
            distance,
            coordinates: `${lat},${lng}`,
            mapUrl: `https://www.google.com/maps/search/${encodeURIComponent(name)}+${encodeURIComponent(city)}`,
          });
          if (places.length === 4) break;
        }
      }
    }

    if (places.length !== 4) {
      return res.json([
        {
          name: "Lalbagh Botanical Garden",
          description: "Famous botanical garden with diverse plant species and beautiful landscapes.",
          distance: "3 km from city center",
          coordinates: "12.9507,77.5848",
          mapUrl: "https://www.google.com/maps/search/Lalbagh+Botanical+Garden+Bangalore",
        },
        {
          name: "Cubbon Park",
          description: "Large public park perfect for walking and relaxation in the heart of the city.",
          distance: "1 km from city center",
          coordinates: "12.9767,77.5928",
          mapUrl: "https://www.google.com/maps/search/Cubbon+Park+Bangalore",
        },
        {
          name: "Bangalore Palace",
          description: "Historic palace with Tudor-style architecture and royal heritage.",
          distance: "5 km from city center",
          coordinates: "12.9988,77.5928",
          mapUrl: "https://www.google.com/maps/search/Bangalore+Palace+Bangalore",
        },
        {
          name: "Vidhana Soudha",
          description: "Iconic government building showcasing Dravidian architecture.",
          distance: "2 km from city center",
          coordinates: "12.9784,77.5908",
          mapUrl: "https://www.google.com/maps/search/Vidhana+Soudha+Bangalore",
        },
      ]);
    }

    res.json(places);
  } catch (err) {
    console.error("Recommendations error:", err);
    res.status(500).json({ error: err.message || "Server error" });
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
    if (!city || !vibes || vibes.length === 0)
      return res.status(400).json({ error: "City and vibes are required" });

    const apiKey = process.env.GEMINI_API_KEY || "AIzaSyDdnwlDs0ZUeL6T0wUZJ0HMu8aMJm27ohI";
    const modelName = "gemini-2.5-flash";
    const url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent";

    const prompt = `
      Suggest 6 to 8 travel places near ${city} within ${radius} km radius.
      Include JSON objects with keys: name, description, distance, fare, rating, latitude, longitude.
      Consider vibes: ${vibes.join(", ")}.
      Return ONLY a pure JSON array — no markdown, no text.
    `;

    const response = await fetch(url, {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey
      },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.6, maxOutputTokens: 800 },
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Gemini API error: ${response.status} - ${text}`);
    }

    const data = await response.json();
    let textResponse = data?.candidates?.[0]?.content?.parts?.[0]?.text || "[]";
    textResponse = textResponse.replace(/```json|```/g, "").trim();

    let places = [];
    try {
      const rawPlaces = JSON.parse(textResponse);
      places = rawPlaces.map(p => ({
        name: p.name || "Unknown",
        description: p.description || "No description",
        distance: p.distance || "?",
        fare: p.fare || "?",
        rating: p.rating || "?",
        latitude: p.latitude || 0,
        longitude: p.longitude || 0
      }));
    } catch (err) {
      console.error("JSON parse error:", err, textResponse);
      // Return fallback data if JSON parsing fails
      places = [
        {
          name: "Lalbagh Botanical Garden",
          description: "Famous botanical garden with diverse plant species and beautiful landscapes.",
          distance: "3",
          fare: "150",
          rating: "4.5",
          latitude: 12.9507,
          longitude: 77.5848
        },
        {
          name: "Cubbon Park",
          description: "Large public park perfect for walking and relaxation in the heart of the city.",
          distance: "1",
          fare: "100",
          rating: "4.3",
          latitude: 12.9767,
          longitude: 77.5928
        }
      ];
    }

    res.json(places);
  } catch (err) {
    console.error("💥 /recommend route error:", err);
    res.status(500).json({ error: "Server error" });
  }
});
