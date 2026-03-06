const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  username: { 
    type: String, 
    required: true, 
    unique: true,
    trim: true,
    minlength: 3,
    maxlength: 30
  },
  email: { 
    type: String, 
    required: true, 
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email']
  },
  password: { 
    type: String, 
    required: true,
    minlength: 6
  },
  vibe_history: { type: [String], default: [] },
  saved_places: [{
    name:        String,
    city:        String,
    vibe:        String,
    description: String,
    saved_at:    { type: Date, default: Date.now }
  }],
  itineraries: [{
    day:    Number,
    vibe:   String,
    places: [String],
    saved_at: { type: Date, default: Date.now }
  }],
  interactions: [{
  name:      String,
  city:      { type: String, default: "" },
  vibe:      { type: String, default: "" },
  rating:    { type: Number, default: 3 },
  latitude:  Number,
  longitude: Number,
  action: { type: String, enum: ["saved", "map_opened", "itinerary_selected"] },
  timestamp: { type: Date, default: Date.now }
}],
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Hash password before saving
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Method to compare password
userSchema.methods.comparePassword = async function(candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model('User', userSchema);
