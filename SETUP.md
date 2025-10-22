# Triptrove MongoDB Setup Guide

## Prerequisites

1. **MongoDB Installation**
   - **Local MongoDB**: Install MongoDB Community Server from [mongodb.com](https://www.mongodb.com/try/download/community)
   - **MongoDB Atlas** (Cloud): Create a free account at [mongodb.com/atlas](https://www.mongodb.com/atlas)

2. **Node.js**: Make sure you have Node.js installed

## Setup Instructions

### Option 1: Local MongoDB

1. **Install and Start MongoDB**:
   ```bash
   # Windows (if installed via installer)
   # MongoDB should start automatically as a service
   
   # Or manually start MongoDB
   mongod
   ```

2. **Update .env file**:
   ```
   MONGO_URI=mongodb://localhost:27017/triptrove
   PORT=3000
   ```

### Option 2: MongoDB Atlas (Cloud)

1. **Create MongoDB Atlas Account**:
   - Go to [mongodb.com/atlas](https://www.mongodb.com/atlas)
   - Create a free account
   - Create a new cluster (choose free tier)
   - Create a database user
   - Get your connection string

2. **Update .env file**:
   ```
   MONGO_URI=mongodb+srv://username:password@cluster.mongodb.net/triptrove?retryWrites=true&w=majority
   PORT=3000
   ```

## Running the Application

1. **Install Dependencies**:
   ```bash
   npm install
   ```

2. **Test MongoDB Connection**:
   ```bash
   node start-mongodb.js
   ```

3. **Start the Server**:
   ```bash
   npm start
   ```

4. **Access the Application**:
   - Main page: http://localhost:3000
   - Login page: http://localhost:3000/login.html

## Features Implemented

✅ **User Registration**:
- Username, email, and password validation
- Password hashing with bcrypt
- Duplicate email/username prevention

✅ **User Login**:
- Email and password authentication
- Secure password comparison
- User session management

✅ **Security Features**:
- Password hashing with bcrypt
- Input validation and sanitization
- Error handling and user feedback

✅ **Frontend Integration**:
- Responsive login/signup forms
- Real-time validation feedback
- Smooth transitions between forms

## API Endpoints

- `POST /signup` - Register a new user
- `POST /login` - Authenticate user login
- `GET /` - Main application page

## Database Schema

**Users Collection**:
```javascript
{
  username: String (required, unique, 3-30 chars),
  email: String (required, unique, valid email format),
  password: String (required, min 6 chars, hashed),
  createdAt: Date (auto-generated)
}
```

## Troubleshooting

1. **MongoDB Connection Issues**:
   - Ensure MongoDB is running (local) or cluster is active (Atlas)
   - Check connection string in .env file
   - Verify network access (for Atlas)

2. **Port Issues**:
   - Change PORT in .env if 3000 is occupied
   - Update server.js if needed

3. **Dependencies**:
   - Run `npm install` to ensure all packages are installed
   - Check package.json for required dependencies

## Next Steps

- Add JWT tokens for session management
- Implement password reset functionality
- Add user profile management
- Enhance security with rate limiting
- Add email verification
