const mongoose = require('mongoose');

const connectDB = async () => {
    try {
        let uri = process.env.MONGODB_URI;
        if (!uri) {
            const { MongoMemoryServer } = require('mongodb-memory-server');
            const mongoServer = await MongoMemoryServer.create();
            uri = mongoServer.getUri();
            console.log("Using MongoDB Memory Server");
        }
        const conn = await mongoose.connect(uri, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
        });
        console.log(`MongoDB Connected: ${conn.connection.host}`);
    } catch (err) {
        console.error(`Error: ${err.message}`);
        // Exit process with failure
        // process.exit(1); 
    }
};

// User Schema
const UserSchema = new mongoose.Schema({
    firstName: { type: String, required: true },
    lastName: { type: String, required: true },
    username: { type: String, required: true, unique: true },
    phone: { type: String },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true }, // Ideally hashed
    points: { type: Number, default: 0 },
    totalFocusTime: { type: Number, default: 0 }, // in seconds
    dailyStats: [{
        date: { type: String, required: true }, // Format: YYYY-MM-DD
        focusTime: { type: Number, default: 0 },
        points: { type: Number, default: 0 }
    }],
    currentStreak: { type: Number, default: 0 },
    lastStreakUpdate: { type: String, default: "" }, // YYYY-MM-DD
    streakBrokenAt: { type: Date, default: null }, // Timestamp when streak broke
    lastActive: { type: Date, default: Date.now },
    focusScore: { type: Number, default: 100 }, // 0-100 reputation score
    sessionsCompleted: { type: Number, default: 0 },
    perfectSessions: { type: Number, default: 0 },
    achievements: { type: [String], default: [] },
    sessionHistory: { type: Array, default: [] },
    activityFeed: { type: Array, default: [] }
});

const User = mongoose.model('User', UserSchema);

module.exports = { connectDB, User };
