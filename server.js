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
const connectDB = async () => {
  if (mongoose.connection.readyState >= 1) return;
  await mongoose.connect(process.env.MONGO_URI);
};

// Add this middleware right after app.use(express.json())
app.use(async (req, res, next) => {
  try {
    await connectDB();
    next();
  } catch (err) {
    console.error("DB connection failed:", err);
    res.status(500).json({ message: "Database connection failed" });
  }
});
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
const http = require('http');

app.get('/recommend-for-you', auth, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ message: 'User not found' });

    const city = req.query.city || '';

    // Call Flask ML service
    const mlPayload = JSON.stringify({
      user_id: req.userId.toString(),
      city: city.toLowerCase(),
      top_k: 3
    });

    const options = {
      hostname: '127.0.0.1',
      port: 5001,
      path: '/ml-recommend',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(mlPayload)
      }
    };

    const mlRequest = http.request(options, (mlRes) => {
      let rawData = '';
      mlRes.on('data', chunk => rawData += chunk);
      mlRes.on('end', () => {
        try {
          const mlData = JSON.parse(rawData);
          res.json({
            recommendations: mlData.recommendations,
            model: mlData.model,
            rmse: mlData.rmse
          });
        } catch (e) {
          res.status(500).json({ message: 'ML parse error' });
        }
      });
    });

    mlRequest.on('error', (e) => {
      console.error('ML service error:', e);
      res.status(500).json({ message: 'ML service unavailable' });
    });

    mlRequest.write(mlPayload);
    mlRequest.end();

  } catch (err) {
    console.error('Recommend for you error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});
// ── TRENDING PLACES ──
app.get('/trending', async (req, res) => {
  try {
    const city = (req.query.city || '').toLowerCase().trim();
    const users = await User.find({});

    const placeCounts = {};

    users.forEach(user => {
      // Check interactions array
      (user.interactions || []).forEach(interaction => {
        const name = interaction.name || interaction.place_name;
        const placeCity = (interaction.city || '').toLowerCase().trim();
        if (!name) return;

        // ← strict city filter
        if (city && placeCity !== city) return;

        if (!placeCounts[name]) {
          placeCounts[name] = {
            name,
            city: interaction.city || '',
            vibe: interaction.vibe || '',
            count: 0
          };
        }
        placeCounts[name].count++;
      });

      // Also check saved_places array
      (user.saved_places || []).forEach(place => {
        const name = place.name;
        const placeCity = (place.city || '').toLowerCase().trim();
        if (!name) return;

        if (city && placeCity !== city) return;

        if (!placeCounts[name]) {
          placeCounts[name] = {
            name,
            city: place.city || '',
            vibe: place.vibe || '',
            count: 0
          };
        }
        placeCounts[name].count++;
      });
    });

    const trending = Object.values(placeCounts)
      .sort((a, b) => b.count - a.count)
      .slice(0, 3);

    res.json({ trending });

  } catch (err) {
    console.error('Trending error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});
app.get('/find-travellers', auth, async (req, res) => {
  try {
    // Get current user's vibe history
    const currentUser = await User.findById(req.userId).select('vibe_history username');
    if (!currentUser) return res.status(404).json({ error: 'User not found' });

    // Get all other users' vibe history and username
    const allUsers = await User.find({ _id: { $ne: req.userId } })
      .select('_id username vibe_history');

    const allUsersFormatted = allUsers.map(u => ({
      user_id: u._id.toString(),
      username: u.username,
      vibe_history: u.vibe_history || []
    }));

    // Call Flask KNN endpoint
    const flaskResponse = await new Promise((resolve, reject) => {
      const postData = JSON.stringify({
        user_id: req.userId,
        vibe_history: currentUser.vibe_history || [],
        all_users: allUsersFormatted,
        top_k: 5
      });

      const options = {
        hostname: 'localhost',
        port: 5001,
        path: '/match-travellers',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData)
        }
      };

      const request = http.request(options, (response) => {
        let data = '';
        response.on('data', chunk => data += chunk);
        response.on('end', () => resolve(JSON.parse(data)));
      });

      request.on('error', reject);
      request.write(postData);
      request.end();
    });

    res.json({
      matches: flaskResponse.matches || [],
      your_vibes: currentUser.vibe_history || []
    });

  } catch (err) {
    console.error('Find travellers error:', err);
    res.status(500).json({ error: 'Failed to find travellers' });
  }
});
// =====================
// START SERVER
// =====================
app.listen(PORT, () => {
  console.log(`✅ Triptrove running at http://localhost:${PORT}`);
});