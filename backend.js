require('dotenv').config();
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const { connectDB, User } = require("./server db.js");
const axios = require("axios");
const path = require("path");
const bcrypt = require("bcryptjs");

connectDB().then(() => seedDemoUser());

async function seedDemoUser() {
  try {
    const existingDemo = await User.findOne({ username: 'FocusMaster' });
    if (existingDemo) {
      await User.deleteOne({ username: 'FocusMaster' }); // Always reset on boot to keep it clean
    }
    
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash('Demo@123', salt);
    
    const demoUser = new User({
      firstName: 'Demo',
      lastName: 'User',
      username: 'FocusMaster',
      email: 'demo@focusroom.app',
      password: hashedPassword,
      points: 6420,
      totalFocusTime: 127 * 3600, // 127 hours in seconds
      currentStreak: 32,
      lastStreakUpdate: new Date().toISOString().split('T')[0],
      focusScore: 94,
      sessionsCompleted: 184,
      perfectSessions: 71,
      achievements: [
        'First Session', '7 Day Streak', '30 Day Streak', 
        '100 Focus Hours', '100 Sessions Completed', 
        'Perfect Session Master', 'Survival Veteran', 
        'Deep Work Specialist', 'Consistency Champion'
      ],
      sessionHistory: [
        { title: 'DSA Practice', mode: 'Survival', duration: 90, score: 98, status: 'Completed' },
        { title: 'Backend Development', mode: 'Commitment', duration: 120, score: 94, status: 'Completed' },
        { title: 'System Design Study', mode: 'Survival', duration: 75, score: 100, status: 'Completed' },
        { title: 'LeetCode Grind', mode: 'Survival', duration: 60, score: 92, status: 'Completed' },
        { title: 'Portfolio Build', mode: 'Commitment', duration: 180, score: 99, status: 'Completed' },
        { title: 'Writing Documentation', mode: 'Deep Work', duration: 45, score: 85, status: 'Completed' },
        { title: 'Bug Fixing', mode: 'Survival', duration: 120, score: 88, status: 'Completed' },
        { title: 'Code Review', mode: 'Commitment', duration: 30, score: 100, status: 'Completed' },
        { title: 'Learning Rust', mode: 'Deep Work', duration: 90, score: 95, status: 'Completed' },
        { title: 'Refactoring Architecture', mode: 'Survival', duration: 150, score: 97, status: 'Completed' },
        { title: 'Open Source Contribution', mode: 'Commitment', duration: 60, score: 91, status: 'Completed' },
        { title: 'Database Migration', mode: 'Survival', duration: 120, score: 89, status: 'Completed' },
        { title: 'Frontend Styling', mode: 'Deep Work', duration: 75, score: 96, status: 'Completed' },
        { title: 'Cloud Deployment', mode: 'Commitment', duration: 45, score: 100, status: 'Completed' },
        { title: 'API Integration', mode: 'Survival', duration: 90, score: 93, status: 'Completed' }
      ],
      activityFeed: [
        { text: 'Completed a 3 hour Portfolio Build session', type: 'session', time: '2 hours ago' },
        { text: 'Reached 30 day streak', type: 'achievement', time: '1 day ago' },
        { text: 'Earned Deep Work Specialist achievement', type: 'achievement', time: '2 days ago' },
        { text: 'Completed a 2 hour Backend Development session', type: 'session', time: '2 days ago' },
        { text: 'Achieved Level 14', type: 'level', time: '3 days ago' },
        { text: 'Completed Survival Session with 100% Focus', type: 'session', time: '4 days ago' }
      ]
    });
    
    // Generate 20 fake daily stats for the chart
    const dailyStats = [];
    const today = new Date();
    for (let i = 20; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const hours = Math.floor(Math.random() * 4) + 2; // 2 to 5 hours
      dailyStats.push({
        date: d.toISOString().split('T')[0],
        focusTime: hours * 3600,
        points: hours * 150 // approximate
      });
    }
    demoUser.dailyStats = dailyStats;
    
    await demoUser.save();
    
    // Seed dummy users so Demo User sits at rank 8
    const existingDummies = await User.countDocuments({ username: /DummyUser/ });
    if (existingDummies === 0) {
      const dummyNames = ['Alex', 'Sarah', 'David', 'Elena', 'Michael', 'Jessica', 'James'];
      for (let i = 0; i < 7; i++) {
        await new User({
          firstName: dummyNames[i],
          lastName: 'Smith',
          username: `DummyUser${i}`,
          email: `dummy${i}@focusroom.app`,
          password: hashedPassword,
          points: 8000 + (7 - i) * 500, // Highest points first
          totalFocusTime: 200 * 3600,
          currentStreak: 45 + i,
          focusScore: 95 + i
        }).save();
      }
    }
    
    console.log("Seeded Demo User and dummy leaderboard successfully.");
  } catch (err) {
    console.error("Error seeding demo user:", err);
  }
}

// Telegram Bot Configuration
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHAT_ID = process.env.TELEGRAM_CHAT_ID;

function sendTelegramMessage(text) {
  const url = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;

  axios.post(url, {
    chat_id: CHAT_ID,
    text: text
  }).catch(err => {
    
  });
}

// Cooldown Management (60s)
let lastSent = {};
function canSend(userId) {
  const now = Date.now();
  if (!lastSent[userId] || now - lastSent[userId] > 60000) {
    lastSent[userId] = now;
    return true;
  }
  return false;
}

const app = express();
app.use(cors());
app.use(express.static(path.join(__dirname)));

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
  },
});

// In-memory storage for active rooms only
let rooms = {};

// Global points calculator & timer
setInterval(() => {
  let leaderboardChanged = false;
  const now = Date.now();

  for (let roomId in rooms) {
    let room = rooms[roomId];

    // Ongoing condition based on mode
    const hasStarted = room.startTime && now >= room.startTime;
    const isOngoing = room.roomMode === 'survival' ? true : room.timer > 0;

    if (hasStarted && isOngoing) {
      room.isRunning = true;

      // All modes now use countdown for the phase timer (Pomodoro style)
      room.timer--;
      room.totalTimer--;

      if (room.timer <= 0) {
        // Phase Transition Logic
        if (room.phase === 'Work') {
          room.phase = room.sessionCount % 4 === 0 ? 'Long Break' : 'Short Break';
          room.timer = room.phase === 'Long Break' ? 900 : 300;
          io.to(roomId).emit("alert", "Phase Complete: Time for a break.");
        } else {
          room.phase = 'Work';
          room.timer = 1500;
          room.sessionCount++;
          io.to(roomId).emit("alert", "Phase Complete: Back to work!");
        }
      }

      io.to(roomId).emit("timer_update", {
        phaseTimer: room.timer,
        totalTimer: room.totalTimer,
        phaseName: room.phase,
        session: room.sessionCount
      });

      // Track focus time locally in memory
      room.users.forEach((user) => {
        if (user.status === "active") {
          user.sessionFocusTime = (user.sessionFocusTime || 0) + 1;
        }
      });

      if (room.totalTimer <= 0) {
        io.to(roomId).emit("timer_ended");
        room.isRunning = false;
      }
    }
  }

  if (leaderboardChanged) {
    getLeaderboard().then(lb => io.emit("leaderboard_update", lb));
  }
}, 1000);

// Heartbeat broadcast for public rooms every 10 seconds
setInterval(() => {
  const publicRooms = Object.keys(rooms)
    .filter(rId => rooms[rId].isPublic)
    .map(rId => ({
      id: rId,
      roomName: rooms[rId].roomName,
      roomCode: rooms[rId].roomCode,
      userCount: rooms[rId].users.length
    }));
  if (publicRooms.length > 0) {
    
    io.emit("public_rooms_list", publicRooms);
  }
}, 10000);

async function getLeaderboard() {
  try {
    return await User.find().sort({ points: -1 }).limit(10);
  } catch (e) {
    return [];
  }
}

app.get("/", (req, res) => {
  res.send("Backend running");
});

// Endpoint to fetch public rooms
app.get("/public-rooms", (req, res) => {
  const publicRooms = Object.keys(rooms)
    .filter(roomId => rooms[roomId].isPublic)
    .map(roomId => ({
      id: roomId,
      roomName: rooms[roomId].roomName,
      roomCode: rooms[roomId].roomCode,
      userCount: rooms[roomId].userCount || rooms[roomId].users.length
    }));
  res.json({ rooms: publicRooms });
});

io.on("connection", (socket) => {
  

  socket.on("focus_lost", ({ username, userId }) => {
    

    if (canSend(userId)) {
      sendTelegramMessage(`⚠️ ${username}, you lost focus. Get back to work!`);
    }
  });

  // Return public rooms to requesting clients
  socket.on("get_public_rooms", () => {
    broadcastPublicRooms(socket);
  });

  // Join Room
  socket.on("join_room", (data) => {
    const { roomId, username, firstName, roomName, isPublic = false, roomCode, startTime, roomMode = 'commitment', duration = 1500, whitelist } = data;
    
    socket.join(roomId);

    if (!rooms[roomId]) {
      
      rooms[roomId] = {
        users: [],
        roomName: roomName || 'Focus Room', // Store the room name
        roomMode: roomMode, // 'commitment' | 'survival'
        timer: 1500, // 25 min default phase
        totalTimer: duration, // Total room duration (from user input)
        phase: 'Work',
        sessionCount: 1,
        startTime: startTime || Date.now(),
        isRunning: false,
        isPublic: isPublic,
        roomCode: isPublic ? roomCode : null,
        peakUsers: 0,
        whitelist: whitelist ? whitelist.split(',').map(s => s.trim().toLowerCase()).filter(s => s) : []
      };
    }

    // Check if user is already in the room via socket id
    const existingUser = rooms[roomId].users.find(u => u.id === socket.id);
    if (!existingUser) {
      rooms[roomId].users.push({
        id: socket.id,
        username: username,
        name: firstName || username,
        status: "active",
        isVideoOn: true,
        isAudioOn: true
      });

      if (rooms[roomId].users.length > rooms[roomId].peakUsers) {
        rooms[roomId].peakUsers = rooms[roomId].users.length;
      }

    } else {
      existingUser.status = "active";
    }

    // Send room metadata to the joining socket (use roomTitle key for clarity)
    
    socket.emit("room_init", {
      roomTitle: rooms[roomId].roomName,
      mode: rooms[roomId].roomMode,
      duration: rooms[roomId].totalTimer,
      isPublic: rooms[roomId].isPublic,
      whitelist: rooms[roomId].whitelist || []
    });

    // Notify others in room
    socket.to(roomId).emit("user_joined", { id: socket.id, name: username });
    io.to(roomId).emit("update_users", rooms[roomId].users);

    // Send updated public rooms to everyone if it's a public room
    if (rooms[roomId].isPublic) {
      broadcastPublicRooms(io);
    }
  });

  // Focus Tracking
  socket.on("window_unfocused", (roomId) => {
    if (rooms[roomId]) {
      let user = rooms[roomId].users.find(u => u.id === socket.id);
      if (user) {
        user.status = "unfocused";
        user.focusViolations = (user.focusViolations || 0) + 1;
        io.to(roomId).emit("update_users", rooms[roomId].users);
      }
    }
  });

  socket.on("window_focused", (roomId) => {
    if (rooms[roomId]) {
      let user = rooms[roomId].users.find(u => u.id === socket.id);
      if (user) {
        user.status = "active";
        io.to(roomId).emit("update_users", rooms[roomId].users);
      }
    }
  });



  // Relay WebRTC signals for P2P video
  socket.on("signal", ({ to, signal, from }) => {
    io.to(to).emit("signal", { signal, from: socket.id });
  });

  // Toggle Video
  socket.on("toggle_video", ({ roomId, isVideoOn }) => {
    if (rooms[roomId]) {
      let user = rooms[roomId].users.find(u => u.id === socket.id);
      if (user) {
        user.isVideoOn = isVideoOn;
        io.to(roomId).emit("update_users", rooms[roomId].users);
      }
    }
  });

  // Toggle Audio
  socket.on("toggle_audio", ({ roomId, isAudioOn }) => {
    if (rooms[roomId]) {
      let user = rooms[roomId].users.find(u => u.id === socket.id);
      if (user) {
        user.isAudioOn = isAudioOn;
        io.to(roomId).emit("update_users", rooms[roomId].users);
      }
    }
  });

  // Initial Leaderboard fetch
  socket.on("get_leaderboard", async () => {
    socket.emit("leaderboard_update", await getLeaderboard());
  });

  // User Authentication via Sockets (Synchronized Flow)
  socket.on("register_user", async ({ firstName, lastName, username, phone, email, password }) => {
    try {
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(password, salt);
      const user = new User({ firstName, lastName, username, phone, email, password: hashedPassword });
      await user.save();
      socket.emit("auth_success", { username: user.username, firstName: user.firstName });
    } catch (err) {
      socket.emit("auth_error", "Username or email already exists.");
    }
  });

  socket.on("login_user", async ({ username, password }) => {
    try {
      if (username === process.env.ADMIN_USERNAME && password === process.env.ADMIN_PASSWORD) {
        socket.emit("auth_success", { username: "admin", firstName: "System" });
        return;
      }
      const user = await User.findOne({ $or: [{ username: username }, { email: username }] });
      if (user) {
        const isMatch = await bcrypt.compare(password, user.password);
        if (isMatch) {
          socket.emit("auth_success", { username: user.username, firstName: user.firstName });
        } else {
          socket.emit("auth_error", "Invalid username or password.");
        }
      } else {
        socket.emit("auth_error", "Invalid username or password.");
      }
    } catch (err) {
      socket.emit("auth_error", "A database error occurred.");
    }
  });


  // User Stats Fetch
  socket.on("get_user_stats", async ({ username }) => {
    try {
      
      const todayDate = new Date().toISOString().split('T')[0];
      const user = await User.findOne({ username });
      if (user) {
        // Check if streak was broken (missed yesterday's 30-min goal)
        const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = yesterday.toISOString().split('T')[0];

        let isBroken = false;
        // If the last update was NOT today and NOT yesterday, and the streak is still "active" (>0)
        if (user.currentStreak > 0 && user.lastStreakUpdate !== todayDate && user.lastStreakUpdate !== yesterdayStr) {
          if (!user.streakBrokenAt) {
            user.streakBrokenAt = new Date(); // Record failure timestamp
            await User.findOneAndUpdate({ username }, { streakBrokenAt: user.streakBrokenAt });
          }
          isBroken = true;
        }

        const todayData = user.dailyStats.find(s => s.date === todayDate) || { focusTime: 0, points: 0 };

        const payload = {
          totalPoints: user.points || 0,
          totalFocusTime: user.totalFocusTime || 0,
          todayPoints: todayData.points || 0,
          todayFocusTime: todayData.focusTime || 0,
          currentStreak: isBroken ? 0 : (user.currentStreak || 0),
          isStreakBroken: isBroken,
          canRestore: isBroken && (Date.now() - new Date(user.streakBrokenAt).getTime() < 86400000),
          sessionHistory: user.sessionHistory || [],
          activityFeed: user.activityFeed || [],
          achievements: user.achievements || [],
          focusScore: user.focusScore || 100,
          perfectSessions: user.perfectSessions || 0,
          sessionsCompleted: user.sessionsCompleted || 0,
          dailyStats: user.dailyStats || []
        };

        
        socket.emit("user_stats_update", payload);
      } else {
        
      }
    } catch (e) {  }
  });

  // Strength Restore Action
  socket.on("restore_streak", async ({ username }) => {
    try {
      const user = await User.findOne({ username });
      if (user && user.streakBrokenAt) {
        const now = Date.now();
        const timeElapsed = now - new Date(user.streakBrokenAt).getTime();
        const streakCost = 500; // Redemption cost

        if (timeElapsed < 86400000 && user.points >= streakCost) {
          // To restore effectively, we set lastStreakUpdate to YESTERDAY
          const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1);
          const yesterdayStr = yesterday.toISOString().split('T')[0];

          await User.findOneAndUpdate(
            { username },
            {
              $inc: { points: -streakCost },
              $set: { streakBrokenAt: null, lastStreakUpdate: yesterdayStr }
            }
          );
          socket.emit("alert", "Laboratory Streak Restored! Don't lose focus again.", "success");
          socket.emit("get_user_stats", { username }); // Refresh dashboard
        } else {
          socket.emit("alert", "Restoration failed: Insufficient points or 24h window closed.");
        }
      }
    } catch (e) {  }
  });

  // Leave Room Explicitly
  socket.on("leave_room", async ({ roomId }) => {
    await handleUserLeaving(socket.id, roomId, true);
    socket.leave(roomId);
  });

  // Disconnect
  socket.on("disconnect", async () => {
    for (let roomId in rooms) {
      if (rooms[roomId] && rooms[roomId].users.find(u => u.id === socket.id)) {
        await handleUserLeaving(socket.id, roomId, false);
      }
    }
  });

  async function handleUserLeaving(socketId, roomId, isGraceful) {
    if (!rooms[roomId]) return;
    let userInRoom = rooms[roomId].users.find(u => u.id === socketId);
    if (!userInRoom) return;

    let username = userInRoom.username;
    let sessionFocusTime = userInRoom.sessionFocusTime || 0;
    let focusViolations = userInRoom.focusViolations || 0;

    // Remove user from room
    rooms[roomId].users = rooms[roomId].users.filter((user) => user.id !== socketId);
    
    // Empty room cleanup
    if (rooms[roomId].users.length === 0) {
      delete rooms[roomId];
      broadcastPublicRooms(io);
    } else {
      io.to(roomId).emit("update_users", rooms[roomId].users);
      io.to(roomId).emit("user_disconnected", socketId);
      if (rooms[roomId] && rooms[roomId].isPublic) broadcastPublicRooms(io);
    }

    // Process Mastery & Session History
    if (sessionFocusTime > 0) {
       await awardMastery(username, sessionFocusTime, focusViolations, rooms[roomId] ? rooms[roomId].roomMode : 'commitment', socketId);
    }
  }

  async function awardMastery(username, sessionFocusTime, focusViolations, roomMode, socketId) {
    if (!sessionFocusTime || sessionFocusTime < 30) return null; // less than 30s, no XP
    
    const user = await User.findOne({ username });
    if (!user) return null;

    // Base XP Calculation (Non-linear)
    const focusMinutes = sessionFocusTime / 60;
    let baseXP = 0;
    if (focusMinutes >= 180) baseXP = 150;
    else if (focusMinutes >= 90) baseXP = 70;
    else if (focusMinutes >= 50) baseXP = 35;
    else if (focusMinutes >= 25) baseXP = 15;
    else baseXP = Math.floor(focusMinutes * 0.5); 

    // Multiplier
    let multiplier = roomMode === 'survival' ? 1.5 : 1;
    
    // Perfect Session
    let perfectBonus = 0;
    let isPerfect = false;
    if (focusViolations === 0 && focusMinutes >= 25) {
      isPerfect = true;
      perfectBonus = Math.floor(baseXP * 0.25);
    }

    // Focus Reputation (Accountability Score 0-100)
    let repMultiplier = 1;
    if (user.focusScore > 90) repMultiplier = 1.1;
    else if (user.focusScore < 50) repMultiplier = 0.8;

    let totalXP = Math.floor((baseXP * multiplier + perfectBonus) * repMultiplier);

    // Adjust Focus Score (reputation)
    let newFocusScore = user.focusScore || 100;
    if (isPerfect) newFocusScore = Math.min(100, newFocusScore + 2);
    else if (focusViolations > 3) newFocusScore = Math.max(0, newFocusScore - Math.floor(focusViolations / 2));

    const todayDate = new Date().toISOString().split('T')[0];
    
    let updatedUser = await User.findOneAndUpdate(
      { username, "dailyStats.date": todayDate },
      {
        $inc: { "dailyStats.$.points": totalXP, "dailyStats.$.focusTime": sessionFocusTime, points: totalXP, totalFocusTime: sessionFocusTime, sessionsCompleted: 1, perfectSessions: isPerfect ? 1 : 0 },
        $set: { focusScore: newFocusScore }
      },
      { new: true }
    );

    if (!updatedUser) {
      updatedUser = await User.findOneAndUpdate(
        { username },
        {
          $inc: { points: totalXP, totalFocusTime: sessionFocusTime, sessionsCompleted: 1, perfectSessions: isPerfect ? 1 : 0 },
          $set: { focusScore: newFocusScore },
          $push: { dailyStats: { date: todayDate, points: totalXP, focusTime: sessionFocusTime } }
        },
        { new: true }
      );
    }

    // Update streak if needed (>= 30 mins)
    const todayData = updatedUser.dailyStats.find(s => s.date === todayDate) || { focusTime: sessionFocusTime };
    if (todayData.focusTime >= 1800 && updatedUser.lastStreakUpdate !== todayDate) {
      updatedUser = await User.findOneAndUpdate(
         { username },
         { $inc: { currentStreak: 1 }, $set: { lastStreakUpdate: todayDate, streakBrokenAt: null } },
         { new: true }
      );
    }

    const report = {
      baseXP,
      multiplier,
      perfectBonus,
      totalXP,
      isPerfect,
      newFocusScore,
      focusMinutes: Math.floor(focusMinutes),
      currentStreak: updatedUser.currentStreak,
      level: Math.max(1, Math.floor(updatedUser.points / 500) + 1),
      mode: roomMode
    };

    io.to(socketId).emit("session_summary", report);
    
    // Force a stats refresh
    io.to(socketId).emit("user_stats_update", {
      totalPoints: updatedUser.points,
      totalFocusTime: updatedUser.totalFocusTime,
      todayPoints: todayData.points,
      todayFocusTime: todayData.focusTime,
      currentStreak: updatedUser.currentStreak || 0
    });
  }

  function broadcastPublicRooms(targetOrIo) {
    const publicRooms = Object.keys(rooms)
      .filter(rId => rooms[rId].isPublic)
      .map(rId => ({
        id: rId,
        roomName: rooms[rId].roomName,
        roomCode: rooms[rId].roomCode,
        userCount: rooms[rId].users.length
      }));
    targetOrIo.emit("public_rooms_list", publicRooms);
  }
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  
});
