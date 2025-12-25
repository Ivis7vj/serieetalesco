const mongoose = require('mongoose');

const connectDB = async () => {
    try {
        const conn = await mongoose.connect(process.env.MONGODB_URI, {
            serverSelectionTimeoutMS: 3000 // Fail fast (3s) if DB is down
        });
        console.log(`MongoDB Connected: ${conn.connection.host}`);
    } catch (error) {
        console.error(`Error: ${error.message}`);
        // Do not exit process, just log error. 
        // App should still work if DB fails (Fallback mode implied by structure, though this is startup).
        // If Logic depends on DB connection state, we might need to handle 'disconnected' event.
    }
};

module.exports = connectDB;
