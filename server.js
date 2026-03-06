const express = require("express");
const mongoose = require("mongoose");
const path = require("path");
const dotenv = require("dotenv");
const cors = require("cors");
const User = require("./model/user");
const frontRouter = require("./front.js");
const Groq = require("groq-sdk");
const jwt = require('jsonwebtoken');
const auth = require('./middleware/auth');
// Load env
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Groq init
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// MongoDB
app.use(async (req, res, next) => {
  await connectDB();
  next();
});
let isConnected = false;

async function connectDB() {
  if (isConnected) return;
  await mongoose.connect(process.env.MONGO_URI, {
    serverSelectionTimeoutMS: 30000,
    socketTimeoutMS: 45000,
    bufferCommands: false,
  });
  isConnected = true;
  console.log("✅ Connected to MongoDB");
}

connectDB();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));
app.use(frontRouter);

// Root
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// =====================
// GROQ HELPER
// =====================
async function askGroq(prompt) {
  const completion = await groq.chat.completions.create({
    model: "llama-3.1-8b-instant",
    messages: [{ role: "user", content: prompt }],
  });
  return completion.choices[0].message.content;
}

// =====================
// RECOMMENDATIONS
// =====================

app.post("/recommendations", async (req, res) => {
  try {
    const { city, vibe, visited = [], bookmarked = [], selected = [], shown = [] } = req.body;

    if (!city || !vibe)
      return res.status(400).json({ error: "City and vibe are required" });

    const avoidList = [...new Set([...visited, ...selected, ...shown])];

    const prompt = `
Recommend exactly 4 unique ${vibe} places in ${city}.
Each on a new line.
Format: Name | 1-2 sentence description | Distance from city center

STRICTLY avoid these places (do not include any of them): ${avoidList.length > 0 ? avoidList.join(", ") : "none"}
Include 1-2 of these bookmarked places if possible: ${bookmarked.length > 0 ? bookmarked.join(", ") : "none"}

Return ONLY 4 lines in the exact format above. No numbering, no extra text.
`;

    const text = await askGroq(prompt);

    const places = text
      .split("\n")
      .map(l => l.trim())
      .filter(l => l.includes("|"))
      .slice(0, 4)
      .map(line => {
        const [name, description, distance] = line.split("|").map(s => s.trim());
        return {
          name,
          description,
          distance,
          mapUrl: `https://www.google.com/maps/search/${encodeURIComponent(name)}+${encodeURIComponent(city)}`
        };
      });

    res.json(places);
  } catch (err) {
    console.error("Recommendations error:", err);
    res.status(500).json({ error: "Groq failed" });
  }
});

app.post("/budget", async (req, res) => {
  try {
    const { city, places } = req.body;

    if (!places || places.length === 0)
      return res.status(400).json({ error: "No places provided" });

    const placeNames = places.map(p => p.name).join(", ");

    const prompt = `
The user is visiting these places in ${city} in one day: ${placeNames}.
Estimate the total budget in Indian Rupees (INR) for visiting all these places.
Consider: entry/ticket fees, one average meal, and local transport between all places.
Return ONLY a raw JSON object. No markdown. No explanation. Just the JSON.
Format: {"total": 2500, "breakdown": {"entry": 800, "food": 1000, "transport": 700}}
`;

    const text = await askGroq(prompt);
    const cleaned = text.replace(/```json|```|`/g, "").trim();

    let budget;
    try {
      const parsed = JSON.parse(cleaned);
      // handle if Groq wraps it in a key
      budget = parsed.total ? parsed : Object.values(parsed)[0];
    } catch (err) {
      console.error("Budget parse error:", err, text);
      return res.status(500).json({ error: "Failed to parse budget" });
    }

    res.json(budget);
  } catch (err) {
    console.error("Budget error:", err);
    res.status(500).json({ error: "Failed to estimate budget" });
  }
});


app.post('/bookmark', auth, async (req, res) => {
  try {
    const { name, description, distance, mapUrl, vibes } = req.body;

    await User.findByIdAndUpdate(
      req.userId,
      {
        $addToSet: {
          saved_places: { name, description, distance, mapUrl, vibes }
        }
      },
      { new: true }
    );

    res.json({ message: 'Bookmarked successfully' });
  } catch (err) {
    console.error('Bookmark error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});
app.get("/debug/saved", auth, async (req, res) => {
  const user = await User.findById(req.userId).select("saved_places interactions vibe_history");
  res.json(user);
});
// =====================
// USER SIGNUP
// =====================
app.post("/signup", async (req, res) => {
  try {
    const { username, email, password } = req.body;

    if (!username || !email || !password)
      return res.status(400).json({ message: "All fields required" });

    if (password.length < 6)
      return res.status(400).json({ message: "Password too short" });

    const exists = await User.findOne({ $or: [{ email }, { username }] });
    if (exists)
      return res.status(400).json({ message: "User already exists" });

    const user = new User({ username, email, password });
    await user.save();

    
    const token = jwt.sign(
      { userId: user._id },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.status(201).json({
      message: "Signup successful",
      token,                   
      user: { id: user._id, username, email }
    });

  } catch (err) {
    console.error("Signup error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// =====================
// USER LOGIN
// =====================
app.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });
    if (!user || !(await user.comparePassword(password)))
      return res.status(401).json({ message: "Invalid credentials" });

    // ← ADD THIS — generate token
    const token = jwt.sign(
      { userId: user._id },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      message: "Login successful",
      token,                    // ← ADD THIS
      user: { id: user._id, username: user.username, email }
    });

  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ message: "Server error" });
  }
});
app.get('/profile', auth, async (req, res) => {
  try {
    const user = await User.findById(req.userId)
      .select('username email saved_places interactions vibe_history createdAt');
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json(user);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// =====================
// START SERVER
// =====================
app.listen(PORT, () => {
  console.log(`✅ Triptrove running at http://localhost:${PORT}`);
});