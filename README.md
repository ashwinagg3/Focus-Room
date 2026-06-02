# 🎯 Focus Room

**Focus Room** is a real-time accountability platform designed to help individuals achieve deep work through social commitment, live coworking, and focus enforcement.

Unlike traditional Pomodoro timers or productivity trackers, Focus Room creates an environment where users can work together in virtual focus rooms, stay accountable through live video presence, and build consistency through mastery progression, streaks, and focus reputation.

The goal is simple:

> **Make distraction costly and focus rewarding.**

---

## ✨ Why Focus Room?

Most productivity applications rely entirely on self-discipline.

Focus Room introduces **social accountability**.

When you enter a focus session, other participants can see you working. Focus violations can be detected automatically, accountability systems can be triggered, and your performance contributes to your long-term focus reputation.

The result is a productivity experience that feels closer to a virtual coworking space than a traditional timer application.

---

## Live Demo

https://focus-room-production.up.railway.app

---

## Demo Account

Email: demo@focusroom.app

Password: Demo@123

No registration required. Feel free to explore all features.

---

# 🚀 Core Features

## 🎥 Real-Time Focus Rooms

Create or join live focus sessions with other participants.

Features include:

* Live video collaboration
* Real-time participant synchronization
* Public focus rooms
* Private focus rooms
* Room activity tracking
* Live participant status

Built using WebRTC peer-to-peer communication for low-latency interaction.

---

## 🎯 Focus Monitoring

Focus Room actively monitors session engagement.

Detection mechanisms include:

* Window blur detection
* Tab switching detection
* Session inactivity tracking
* Focus state synchronization

When focus is lost:

* User status updates in real time
* Session accountability mechanisms activate
* Focus violations are recorded

---

## 🔥 Survival Mode

A high-accountability focus mode designed for maximum discipline.

Features:

* Strict focus enforcement
* Enhanced monitoring
* Focus violation tracking
* Accountability alerts
* Higher mastery rewards

Designed for users who want external pressure to maintain focus.

---

## 🌱 Commitment Mode

A balanced productivity mode focused on sustainable progress.

Features:

* Reduced pressure
* Session tracking
* Mastery progression
* Consistency building

Ideal for daily deep work sessions.

---

## 📩 Telegram Accountability Alerts

Optional Telegram integration allows users to receive immediate notifications when focus is lost.

Possible triggers:

* Window blur
* Extended inactivity
* Session violations

This creates an additional layer of accountability beyond the browser.

---

## 🏆 Mastery System

Focus Room includes a progression ecosystem designed to reward consistency rather than simple screen time.

Users earn Mastery through:

* Session completion
* Long focus sessions
* Perfect sessions
* Streak maintenance
* Survival Mode participation

Progression includes:

* Levels
* Achievements
* Mastery Points
* Focus Reputation
* Performance milestones

---

## 📈 Focus Analytics

Track personal growth over time.

Metrics include:

* Total focus hours
* Session completion rate
* Current streak
* Longest streak
* Focus score
* Mastery level
* Session history

---

## 🥇 Global Leaderboard

Compete with other users through meaningful productivity metrics.

Rankings are based on:

* Mastery points
* Focus consistency
* Session performance
* Long-term discipline

The leaderboard rewards reliability rather than raw activity.

---

## 🌐 Research Whitelist

Not all productive work happens in a single tab.

Focus Room allows users to configure approved research domains.

Examples:

* GitHub
* LeetCode
* Stack Overflow
* Documentation websites

Approved domains can be used without triggering focus penalties.

---

# 🏗️ System Architecture

## Frontend

* HTML5
* Tailwind CSS
* Vanilla JavaScript (ES6+)

### Responsibilities

* Session management
* UI rendering
* Focus detection
* WebRTC integration
* Socket synchronization

---

## Backend

* Node.js
* Express.js

### Responsibilities

* Authentication
* Room management
* Session tracking
* API services
* Real-time communication

---

## Database

* MongoDB
* Mongoose

### Stores

* User accounts
* Focus sessions
* Streaks
* Mastery data
* Achievements
* Leaderboards

---

## Real-Time Layer

### Socket.io

Used for:

* Participant synchronization
* Room updates
* Status updates
* Activity feeds
* Focus events

---

### WebRTC

Used for:

* Video communication
* Audio communication
* Peer-to-peer collaboration

---

# 📂 Key Modules

## Authentication System

Supports:

* Registration
* Login
* Session persistence
* Protected routes

---

## Room Management

Supports:

* Room creation
* Public rooms
* Private rooms
* Participant management
* Session lifecycle

---

## Focus Detection Engine

Tracks:

* Tab visibility
* Window focus
* Activity state
* Session engagement

---

## Mastery Engine

Calculates:

* XP rewards
* Focus score
* Achievement progress
* Streak bonuses
* Level progression

---

## Notification Engine

Handles:

* Telegram alerts
* Accountability events
* System notifications

---

# 🔒 Privacy & Security

Focus Room prioritizes user privacy.

Key principles:

* Peer-to-peer video communication
* Secure authentication
* Environment variable protection
* Controlled room access
* Private room support

---

# ⚡ Installation

Clone the repository:

```bash
git clone <repository-url>
cd focus-room
```

Install dependencies:

```bash
npm install
```

Create a `.env` file:

```env
PORT=3000

MONGODB_URI=mongodb://localhost:27017/focusroom

TELEGRAM_BOT_TOKEN=your_bot_token
TELEGRAM_CHAT_ID=your_chat_id

```

Start the application:

```bash
npm start
```

Application URL:

```text
http://localhost:3000
```

---

# 🎮 Usage

### 1. Create an Account

Register a new account or use the administrator credentials.

---

### 2. Create a Focus Room

Configure:

* Room name
* Session mode
* Session duration
* Research whitelist

---

### 3. Join a Session

Invite participants or join existing rooms.

Enable:

* Camera
* Microphone

Begin focused work.

---

### 4. Maintain Focus

Stay active.

Avoid:

* Tab switching
* Window blurring
* Extended inactivity

Maintain a high focus score and earn mastery rewards.

---

### 5. Progress

Build:

* Streaks
* Reputation
* Levels
* Achievements

Climb the leaderboard through consistent deep work.

---

# 💡 What I Learned Building This Project

Building Focus Room involved solving challenges across multiple domains:

* Real-time systems
* WebRTC networking
* Socket synchronization
* Focus detection
* State management
* User experience design
* Gamification systems
* Full-stack application architecture

The project combines productivity, social accountability, and real-time communication into a single platform designed to help users stay focused and consistent.

---

# 🛣️ Future Improvements

Potential future enhancements include:

* AI-powered focus insights
* Team workspaces
* Session recordings
* Productivity analytics
* Mobile application
* Calendar integrations
* Advanced focus reputation system
* Community challenges

---


## Built with the belief that focus is a skill, and accountability makes it stronger.
