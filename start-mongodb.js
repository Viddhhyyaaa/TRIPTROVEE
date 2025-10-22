// Simple MongoDB connection test script
const mongoose = require('mongoose');
require('dotenv').config();

async function testConnection() {
    try {
        await mongoose.connect(process.env.MONGO_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });
        console.log('✅ MongoDB connection successful!');
        console.log('Database:', mongoose.connection.db.databaseName);
        
        // Test creating a user
        const User = require('./model/user');
        console.log('✅ User model loaded successfully!');
        
        // Close connection
        await mongoose.connection.close();
        console.log('✅ Connection closed.');
    } catch (error) {
        console.error('❌ MongoDB connection failed:', error.message);
        console.log('\n💡 Make sure MongoDB is running locally or update MONGO_URI in .env file');
        console.log('   For local MongoDB: mongodb://localhost:27017/triptrove');
        console.log('   For MongoDB Atlas: mongodb+srv://username:password@cluster.mongodb.net/triptrove');
    }
}

testConnection();
