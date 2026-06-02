const socket = io();

const state = {
    username: localStorage.getItem('focus_user') || null,
    currentRoomId: null,
    isFocused: true,
    users: [],
    timerLimit: 0,
    timerCurrent: 0,
    firstName: localStorage.getItem('focus_fname') || '',
    media: { micOn: true, vidOn: true },
    localStream: null,
    peers: {}, // socketId -> { peer, stream }
    whitelist: [],
    researchModeTimeout: null
};

// ====== DOM ELEMENTS ======
const views = {
    welcome: document.getElementById('welcome-page'),
    login: document.getElementById('login-page'),
    register: document.getElementById('register-page'),
    home: document.getElementById('home-page'),
    create: document.getElementById('create-room-page'),
    leaderboard: document.getElementById('global-leaderboard-page'),
    room: document.getElementById('room-page')
};

const dom = {
    // Auth elements
    btnToLogin: document.getElementById('btn-to-login'),
    btnToRegister: document.getElementById('btn-to-register'),
    btnBackToWelcome1: document.getElementById('btn-back-to-welcome-1'),
    btnBackToWelcome2: document.getElementById('btn-back-to-welcome-2'),
    btnLoginSubmit: document.getElementById('btn-login-submit'),
    btnRegisterSubmit: document.getElementById('btn-register-submit'),

    loginUsername: document.getElementById('login-username'),
    loginPassword: document.getElementById('login-password'),

    regFirstname: document.getElementById('reg-firstname'),
    regLastname: document.getElementById('reg-lastname'),
    regUsername: document.getElementById('reg-username'),
    regPhone: document.getElementById('reg-phone'),
    regEmail: document.getElementById('reg-email'),
    regPassword: document.getElementById('reg-password'),

    // App elements
    homeGreeting: document.getElementById('home-greeting'),
    homeSubtitle: document.getElementById('home-subtitle'),
    btnGlobalLeaderboard: document.getElementById('btn-global-leaderboard'),
    btnBackHomeLb: document.getElementById('btn-back-home-lb'),
    globalLeaderboardList: document.getElementById('global-leaderboard-list'),

    videoGrid: document.getElementById('video-grid'),
    btnToggleMic: document.getElementById('btn-toggle-mic'),
    btnToggleVid: document.getElementById('btn-toggle-vid'),

    roomList: document.getElementById('room-list'),
    btnCreateRoom: document.getElementById('btn-create-room'),
    btnJoinRoom: document.getElementById('btn-join-room'),
    inputRoomCode: document.getElementById('input-room-code'),

    btnBackHome: document.getElementById('btn-back-home'),
    btnSubmitCreate: document.getElementById('btn-submit-create'),
    inputCreateName: document.getElementById('input-create-name'),
    selectCreateMode: document.getElementById('select-create-mode'),
    selectCreatePrivacy: document.getElementById('select-create-privacy'),
    inputCreateTime: document.getElementById('input-create-time'),

    btnLeaveRoom: document.getElementById('btn-leave-room'),
    roomTitle: document.getElementById('room-title'),
    roomCodeDisplay: document.getElementById('room-code-display'),
    roomMode: document.getElementById('room-mode'),

    totalRoomTime: document.getElementById('total-room-time'),
    sessionNumber: document.getElementById('session-number'),
    timerDisplay: document.getElementById('countdown-timer'),
    timerPhaseLabel: document.getElementById('timer-phase-label'),
    participantCount: document.getElementById('participant-count'),
    leaderboard: document.getElementById('leaderboard'),

    alertContainer: document.getElementById('alert-container')
};


// ====== WEBRTC PEER MANAGEMENT ======
function createPeer(userToSignal, callerId, stream) {
    const options = { initiator: true, trickle: false };
    if (stream) options.stream = stream;
    const peer = new SimplePeer(options);

    peer.on("signal", signal => {
        socket.emit("signal", { to: userToSignal, from: callerId, signal });
    });

    return peer;
}

function addPeer(incomingSignal, callerId, stream) {
    const options = { initiator: false, trickle: false };
    if (stream) options.stream = stream;
    const peer = new SimplePeer(options);

    peer.on("signal", signal => {
        socket.emit("signal", { to: callerId, signal });
    });

    peer.signal(incomingSignal);
    return peer;
}


// ====== SOCKET LISTENERS ======
socket.on("connect", () => {
    
    const syncMsg = document.getElementById('sync-status-msg');
    if (syncMsg) {
        syncMsg.style.color = 'var(--status-active)';
        syncMsg.innerHTML = '<span style="width: 6px; height: 6px; border-radius: 50%; background: var(--status-active); box-shadow: 0 0 8px var(--status-active);"></span> CONNECTED TO GLOBAL SERVER • SYNCHRONIZATION ACTIVE';
    }
    socket.emit("get_public_rooms");
    socket.emit("get_leaderboard");
});

socket.on("disconnect", () => {
    
    const syncMsg = document.getElementById('sync-status-msg');
    if (syncMsg) {
        syncMsg.style.color = 'var(--status-error)';
        syncMsg.innerHTML = '<span style="width: 6px; height: 6px; border-radius: 50%; background: var(--status-error); box-shadow: 0 0 8px var(--status-error);"></span> DISCONNECTED FROM SERVER • RECONNECTING...';
    }
});

socket.on("public_rooms_list", (rooms) => {
    renderHomeRooms(rooms);
});

socket.on("update_users", (users) => {
    state.users = users;
    renderRoomUsers(users);
});

socket.on("timer_update", (timerData) => {
    state.timerCurrent = timerData.phaseTimer;
    state.totalTimerRemaining = timerData.totalTimer;
    state.currentPhase = timerData.phaseName;
    state.sessionCount = timerData.session;
    updateTimerDisplay();
});

socket.on("leaderboard_update", (leaderboard) => {
    renderLeaderboard(leaderboard);
});

socket.on("timer_ended", () => {
    showAlert("The session has ended. Excellent work!");
});

socket.on("survival_bonus_awarded", ({ userId, bonus }) => {
    const user = state.users.find(u => u.id === userId);
    if (user) {
        showAlert(`${user.name} is the last survivor! +${bonus} points awarded!`);
    }
});

socket.on("signal", data => {
    const { from, signal } = data;
    if (state.peers[from]) {
        state.peers[from].peer.signal(signal);
    } else {
        const peer = addPeer(signal, from, state.localStream);
        state.peers[from] = { peer };
        
        peer.on("stream", stream => {
            state.peers[from].stream = stream;
            renderRoomUsers(state.users);
        });

        peer.on("error", err => {
            
            delete state.peers[from];
        });
    }
});

socket.on("user_joined", ({ id, name }) => {
    showAlert(`${name} joined the Room.`);
    if (id !== socket.id && state.localStream) {
        // I initiate connection to the new user if I have my stream
        const peer = createPeer(id, socket.id, state.localStream);
        state.peers[id] = { peer };
        
        peer.on("stream", stream => {
            state.peers[id].stream = stream;
            renderRoomUsers(state.users);
        });

        peer.on("error", err => {
            
            delete state.peers[id];
        });
    }
});

socket.on("user_disconnected", (userId) => {
    if (state.peers[userId]) {
        state.peers[userId].peer.destroy();
        delete state.peers[userId];
    }
    renderRoomUsers(state.users);
});


socket.on("user_stats_update", (stats) => {
    const dailyMins = Math.floor(stats.todayFocusTime / 60);
    const dailyHours = Math.floor(dailyMins / 60);
    const remMins = dailyMins % 60;
    
    const timeStr = dailyHours > 0 ? `${dailyHours}h ${remMins}m` : `${remMins}m`;

    if (document.getElementById('stat-daily-time')) {
        document.getElementById('stat-daily-time').innerText = timeStr;
        
        const totalPointsStr = Math.floor(stats.totalPoints).toLocaleString();
        document.getElementById('stat-daily-points').innerText = `+${Math.floor(stats.todayPoints)} today`;
        document.getElementById('stat-total-points').innerText = totalPointsStr;
        
        // Strength (Streak) Logic
        const streakEl = document.getElementById("stat-streak");
        const restoreContainer = document.getElementById("streak-restore-container");
        
        const streakVal = stats.currentStreak || 0;
        if (stats.isStreakBroken && stats.canRestore) {
            streakEl.innerText = "BROKEN";
            streakEl.style.color = "#ff5252"; 
            restoreContainer.classList.remove("hidden");
        } else {
            streakEl.innerText = `${streakVal} Days`;
            streakEl.style.color = "var(--warning)";
            restoreContainer.classList.add("hidden");
        }
        
        // Update Hero and Sidebar Stats
        if (document.getElementById('hero-daily-mins')) {
            document.getElementById('hero-daily-mins').innerText = dailyMins;
            document.getElementById('hero-streak').innerText = streakVal;
        }
        if (document.getElementById('sidebar-streak-value')) {
            document.getElementById('sidebar-streak-value').innerText = `${streakVal} Days`;
            
            // Calculate pseudo level/XP based on total points
            const level = Math.max(1, Math.floor(stats.totalPoints / 500) + 1);
            const xpInLevel = stats.totalPoints % 500;
            const xpPct = Math.min(100, Math.floor((xpInLevel / 500) * 100));
            
            const getLevelTitle = (lvl) => {
                if(lvl >= 100) return "Master of Focus";
                if(lvl >= 75) return "Focus Elite";
                if(lvl >= 50) return "Focus Operator";
                if(lvl >= 35) return "Deep Worker";
                if(lvl >= 20) return "Consistent";
                if(lvl >= 10) return "Disciplined";
                if(lvl >= 5) return "Focused";
                return "Beginner";
            };
            
            const sidebarLevel = document.getElementById('sidebar-level-title');
            if (sidebarLevel) {
                sidebarLevel.innerText = getLevelTitle(level);
                document.getElementById('sidebar-level').innerText = level;
                document.getElementById('sidebar-xp-bar').style.width = `${xpPct}%`;
            }
            if (document.getElementById('sidebar-focus-score')) {
                document.getElementById('sidebar-focus-score').innerText = stats.focusScore || 100;
                document.getElementById('sidebar-total-hours').innerText = Math.floor((stats.totalFocusTime || 0) / 3600);
                document.getElementById('sidebar-perfect-sessions').innerText = stats.perfectSessions || 0;
            }
            if (document.getElementById('rep-focus-score')) {
                document.getElementById('rep-focus-score').innerText = stats.focusScore || 100;
                document.getElementById('rep-streak').innerHTML = `${streakVal}<span class="text-[10px] font-medium text-text-secondary ml-0.5">Days</span>`;
                document.getElementById('rep-perfect').innerHTML = `${stats.perfectSessions || 0}<span class="text-[10px] font-medium text-text-secondary ml-0.5">Total</span>`;
            }
        }
        
        // Render Session History
        if (stats.sessionHistory && document.getElementById('session-history-list')) {
            const list = document.getElementById('session-history-list');
            if (stats.sessionHistory.length === 0) {
                list.innerHTML = '<div class="p-4 text-center text-xs text-text-muted">No session history available yet.</div>';
            } else {
                list.innerHTML = stats.sessionHistory.slice(0, 5).map(s => `
                    <div class="p-4 flex items-center justify-between hover:bg-black/5 transition-soft cursor-pointer group">
                        <div class="flex items-center gap-4">
                            <div class="w-10 h-10 rounded-xl bg-success/10 text-success flex items-center justify-center group-hover:scale-105 transition-transform"><span class="material-symbols-rounded text-[20px]">check</span></div>
                            <div>
                                <div class="text-sm font-semibold text-text-primary mb-0.5">${s.title}</div>
                                <div class="text-[10px] text-text-secondary uppercase tracking-widest font-semibold">${s.mode} • ${s.duration} Minutes</div>
                            </div>
                        </div>
                        <div class="text-right">
                            <div class="text-sm font-bold text-success tabular-nums">${s.score}%</div>
                            <div class="text-[9px] text-text-secondary uppercase tracking-widest font-bold mt-0.5">Focus Score</div>
                        </div>
                    </div>
                `).join('');
            }
        }

        // Render Activity Feed
        if (stats.activityFeed && document.getElementById('activity-feed-list')) {
            const list = document.getElementById('activity-feed-list');
            if (stats.activityFeed.length === 0) {
                list.innerHTML = '<div class="text-xs text-text-muted">No recent activity.</div>';
            } else {
                let html = '<div class="absolute left-[15px] top-4 bottom-4 w-px bg-borderline z-0"></div>';
                html += stats.activityFeed.slice(0, 4).map(a => {
                    let icon = a.type === 'session' ? 'timer' : (a.type === 'achievement' ? 'military_tech' : 'local_fire_department');
                    let colorClass = a.type === 'session' ? 'text-primary' : 'text-warning';
                    let borderClass = a.type === 'session' ? 'border-primary' : 'border-warning';
                    return `
                    <div class="flex gap-4 relative z-10 group">
                        <div class="w-8 h-8 rounded-full bg-surface border-2 border-borderline flex items-center justify-center shrink-0 group-hover:${borderClass} group-hover:${colorClass} transition-colors text-text-secondary"><span class="material-symbols-rounded text-[14px]">${icon}</span></div>
                        <div class="pt-1.5">
                            <p class="text-sm text-text-primary font-medium">${a.text}</p>
                            <span class="text-xs text-text-secondary mt-0.5 block">${a.time}</span>
                        </div>
                    </div>
                    `;
                }).join('');
                list.innerHTML = html;
            }
        }
        
        // Render Weekly Trend Graph
        const chart = document.getElementById('weekly-trend-chart');
        if (chart && stats.dailyStats && stats.dailyStats.length > 0) {
            const last7 = stats.dailyStats.slice(-7);
            const maxFocus = Math.max(...last7.map(d => d.focusTime), 3600); // at least 1 hour
            
            chart.innerHTML = last7.map((day, idx) => {
                const hours = (day.focusTime / 3600).toFixed(1);
                const heightPct = Math.max(5, Math.floor((day.focusTime / maxFocus) * 100));
                
                // Highlight the most recent day or the best day
                const isToday = idx === last7.length - 1;
                const bgClass = isToday ? 'bg-primary shadow-[0_0_12px_rgba(37,99,235,0.4)]' : 'bg-primary/20 hover:bg-primary';
                
                return `
                <div class="w-full ${bgClass} rounded-t-sm transition-soft cursor-pointer relative group" style="height: ${heightPct}%">
                    <div class="opacity-0 group-hover:opacity-100 absolute -top-6 left-1/2 -translate-x-1/2 bg-black text-white text-[9px] font-bold px-2 py-1 rounded whitespace-nowrap">
                        ${hours}h
                    </div>
                </div>
                `;
            }).join('');
        }
    }
});

// Streak Restoration Listener
document.addEventListener('click', (e) => {
    if (e.target && e.target.id === 'btn-restore-streak') {
        e.preventDefault();
        if (confirm("Redeem 500 points to restore your laboratory streak?")) {
            socket.emit("restore_streak", { username: state.username });
        }
    }
});

// ====== VIEW CONTROLLERS ======
function showView(viewName) {
    Object.values(views).forEach(v => v.classList.add('hidden'));
    views[viewName].classList.remove('hidden');

    // Reset title if not in session room
    if (viewName !== 'room') {
        document.title = "FocusRoom | Elite-Tier Productivity";
    }
    
    // Auto-close mobile sidebar
    const sidebar = document.getElementById('app-sidebar');
    if (sidebar) sidebar.classList.add('-translate-x-full');
}

function renderHomeRooms(rooms) {
    
    dom.roomList.innerHTML = '';
    if (rooms.length === 0) {
        dom.roomList.innerHTML = `
            <div style="grid-column: 1/-1; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 4rem 2rem; text-align: center; background: var(--surface); border: 1px dashed var(--borderline); border-radius: 16px; box-shadow: inset 0 2px 8px rgba(0,0,0,0.01);">
                <div style="width: 64px; height: 64px; border-radius: 16px; background: rgba(37,99,235,0.05); display: flex; align-items: center; justify-content: center; margin-bottom: 1.5rem; border: 1px solid rgba(37,99,235,0.1);">
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="text-primary opacity-80"><path d="M12 6v6l4 2"/><circle cx="12" cy="12" r="10"/></svg>
                </div>
                <h4 style="font-size: 1rem; font-weight: 600; color: var(--text-primary); margin-bottom: 0.5rem;">No Active Sessions</h4>
                <p style="font-size: 0.8125rem; color: var(--text-secondary); max-width: 320px; line-height: 1.6; margin-bottom: 1.5rem;">The network is currently resting. Start a Focus Room and invite others to begin a shared deep work session.</p>
                <button onclick="document.getElementById('btn-create-room').click()" class="bg-primary hover:bg-primary/90 text-white text-xs font-bold uppercase tracking-widest px-5 py-2.5 rounded-xl transition-soft shadow-subtle">Create Session</button>
            </div>
        `;
        return;
    }
    rooms.forEach(room => {
        const div = document.createElement('div');
        div.className = 'bg-surface border border-borderline rounded-xl p-4 shadow-subtle hover:shadow-hover hover:-translate-y-0.5 transition-soft shadow-inner-light group relative';
        
        // Generate pseudo-random realistic stats based on room id
        const pseudoRandom = parseInt(room.id.substring(0,4), 16) || 1234;
        const focusRate = 85 + (pseudoRandom % 15);
        const minutesAgo = 5 + (pseudoRandom % 55);
        
        div.innerHTML = `
            <div class="flex justify-between items-start mb-3">
                <div class="flex flex-col">
                    <h3 class="text-sm font-bold text-text-primary tracking-tight">${room.roomName || 'Focus Room'}</h3>
                    <div class="text-[10px] font-medium text-text-secondary uppercase tracking-widest mt-0.5">Survival Mode</div>
                </div>
                <div class="flex items-center gap-1.5 bg-primary/10 px-2 py-1 rounded-lg">
                    <span class="material-symbols-rounded text-primary text-[12px]">person</span>
                    <span class="text-xs font-bold text-primary">${room.userCount}</span>
                </div>
            </div>
            
            <div class="grid grid-cols-2 gap-3 mb-4">
                <div class="bg-background rounded-lg p-2 border border-borderline/50">
                    <div class="text-[9px] text-text-secondary font-bold uppercase tracking-widest mb-0.5">Focus Rate</div>
                    <div class="text-xs font-bold text-success">${focusRate}%</div>
                </div>
                <div class="bg-background rounded-lg p-2 border border-borderline/50">
                    <div class="text-[9px] text-text-secondary font-bold uppercase tracking-widest mb-0.5">Duration</div>
                    <div class="text-xs font-bold text-text-primary tabular-nums">${minutesAgo}m Elapsed</div>
                </div>
            </div>
            
            <div class="flex items-center justify-between mb-4 text-[10px] font-bold uppercase tracking-widest">
                <span class="flex items-center gap-1.5 text-text-secondary">
                    <span class="material-symbols-rounded text-[14px]">vpn_key</span> #${room.roomCode}
                </span>
                <span class="flex items-center gap-1 text-primary">
                    <span class="w-1.5 h-1.5 rounded-full bg-primary animate-pulse"></span> Active
                </span>
            </div>
            
            <button class="w-full bg-background border border-borderline hover:border-primary hover:text-primary text-text-primary font-semibold text-xs uppercase tracking-widest px-4 py-2 rounded-lg transition-soft shadow-sm" onclick="joinRoom('${room.id}', '${room.roomName || 'Public Room'}', 'Survival', 1, true)">
                Enter Room
            </button>
        `;
        dom.roomList.appendChild(div);
    });
}

function renderRoomUsers(users) {
    if (!dom.videoGrid) return;
    dom.videoGrid.innerHTML = '';

    users.forEach(user => {
        const div = document.createElement('div');
        const isFocused = user.status === 'active';
        div.className = `relative aspect-video rounded-2xl overflow-hidden group border-2 transition-all duration-500 shadow-soft ${isFocused ? 'border-transparent' : 'border-danger/80'}`;
        div.setAttribute('data-status', user.status);

        let isMe = user.username === state.username || user.id === socket.id;
        let micIcon = user.isAudioOn ? 'mic' : 'mic_off';

        div.innerHTML = `
            <video class="w-full h-full object-cover ${isMe ? '-scale-x-100' : ''} ${!user.isVideoOn ? 'hidden' : ''} ${!isFocused ? 'grayscale blur-[2px] opacity-60' : ''}" autoplay playsinline ${isMe ? 'muted' : ''}></video>
            
            ${!user.isVideoOn ? `
            <div class="absolute inset-0 bg-surface flex flex-col items-center justify-center border border-borderline rounded-2xl">
                <div class="w-16 h-16 rounded-full bg-black/5 flex items-center justify-center mb-3 shadow-inner-light">
                    <span class="material-symbols-rounded text-text-secondary text-[28px]">videocam_off</span>
                </div>
                <span class="text-xs font-semibold text-text-secondary uppercase tracking-widest">${user.name}</span>
            </div>` : ''}

            <div class="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-80 pointer-events-none rounded-2xl"></div>

            <div class="absolute bottom-4 left-4 right-4 flex items-end justify-between z-20">
                <div class="flex items-center gap-3">
                    <div class="flex items-center justify-center w-8 h-8 rounded-lg ${user.isAudioOn ? 'bg-black/40 text-white backdrop-blur-md' : 'bg-danger/90 text-white shadow-[0_0_12px_rgba(220,38,38,0.5)]'} transition-soft">
                        <span class="material-symbols-rounded text-[16px]">${micIcon}</span>
                    </div>
                    <div class="flex flex-col">
                        <span class="text-white text-sm font-bold tracking-tight">${user.name} ${isMe ? '<span class="opacity-60 text-xs font-medium ml-1">(You)</span>' : ''}</span>
                        <span class="text-white/80 text-[9px] font-bold uppercase tracking-widest mt-0.5">Focus Score: ${isFocused ? '98%' : '32%'}</span>
                    </div>
                </div>
            </div>

            ${!isFocused ? `
            <div class="absolute inset-0 bg-danger/10 z-10 pointer-events-none flex flex-col items-center justify-center">
                 <div class="bg-danger text-white px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-widest shadow-[0_0_20px_rgba(220,38,38,0.4)] flex items-center gap-2 mb-2">
                     <span class="material-symbols-rounded text-[18px]">gavel</span> Focus Lost
                 </div>
                 <div class="text-danger font-bold text-[10px] uppercase tracking-widest bg-white/90 backdrop-blur px-3 py-1 rounded-lg">Accountability Triggered</div>
            </div>` : ''}
            
            ${isFocused ? `
            <div class="absolute top-4 right-4 bg-success/90 backdrop-blur-md text-white px-3 py-1.5 rounded-lg text-[9px] font-bold uppercase tracking-widest shadow-sm flex items-center gap-1.5 z-20 transition-soft group-hover:scale-105">
                <span class="material-symbols-rounded text-[14px]">bolt</span> Locked In
            </div>` : ''}
        `;
        dom.videoGrid.appendChild(div);

        if (isMe && state.localStream && user.isVideoOn) {
            const videoEl = div.querySelector('video');
            videoEl.srcObject = state.localStream;
        } else if (!isMe && state.peers[user.id] && state.peers[user.id].stream && user.isVideoOn) {
            const videoEl = div.querySelector('video');
            videoEl.srcObject = state.peers[user.id].stream;
        }
    });

    if (dom.participantCount) dom.participantCount.innerText = users.length;
}

function renderLeaderboard(leaderboard) {
    dom.leaderboard.innerHTML = '';
    leaderboard.slice(0, 5).forEach((user, index) => {
        const div = document.createElement('div');
        div.className = 'flex items-center justify-between p-3 bg-white/5 rounded-lg border border-white/5 hover:bg-white/10 transition-all';
        div.innerHTML = `
            <div class="flex items-center gap-3">
                <span class="text-sm font-bold text-outline w-4">${index + 1}</span>
                <span class="text-sm text-on-surface font-medium">${user.username}</span>
            </div>
            <span class="text-xs font-bold text-secondary bg-secondary/10 border border-secondary/30 px-2 py-1 rounded-full shadow-[0_0_10px_rgba(34,211,238,0.2)]">${Math.floor(user.points)} pts</span>
        `;
        dom.leaderboard.appendChild(div);
    });

    // Also update global leaderboard page if it's visible
    if (!views.leaderboard || !views.leaderboard.classList.contains('hidden')) {
        renderGlobalLeaderboardPage(leaderboard);
    }
}

function renderGlobalLeaderboardPage(leaderboard) {
    const list = document.getElementById('global-leaderboard-list');
    if (!list) return;
    list.innerHTML = '';
    
    leaderboard.forEach((user, index) => {
        const div = document.createElement('div');
        div.className = 'grid grid-cols-12 gap-4 p-4 items-center hover:bg-black/5 transition-soft';
        
        const level = Math.max(1, Math.floor((user.points || 0) / 500) + 1);
        
        div.innerHTML = `
            <div class="col-span-1 text-center font-bold text-text-secondary">${index + 1}</div>
            <div class="col-span-4 flex items-center gap-3">
                <div class="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xs">${user.username.charAt(0).toUpperCase()}</div>
                <div>
                    <div class="text-sm font-bold text-text-primary leading-tight">${user.username}</div>
                    <div class="text-[10px] font-semibold text-primary uppercase tracking-widest mt-0.5">Lv. ${level}</div>
                </div>
            </div>
            <div class="col-span-2 text-sm font-semibold text-text-primary text-center">${Math.floor(user.points || 0).toLocaleString()} XP</div>
            <div class="col-span-2 text-sm font-bold text-success text-center">${user.focusScore || 100}%</div>
            <div class="col-span-3 text-right flex flex-col items-end">
                <span class="text-xs font-bold text-warning flex items-center gap-1"><span class="material-symbols-rounded text-[14px]">local_fire_department</span> ${user.currentStreak || 0} Days</span>
                <span class="text-[10px] text-text-secondary font-medium mt-0.5">${Math.floor((user.totalFocusTime || 0) / 3600)}h focused</span>
            </div>
        `;
        list.appendChild(div);
    });
}

function updateTimerDisplay() {
    const totalRemaining = state.timerCurrent;
    const isSurvival = dom.roomMode.innerText.toLowerCase() === 'survival';

    // Countdown or Countup logic
    const trMins = Math.floor(totalRemaining / 60);
    const trSecs = totalRemaining % 60;
    const timeStr = `${trMins.toString().padStart(2, '0')}:${trSecs.toString().padStart(2, '0')}`;

    // Total Room Time (Left Panel)
    const overallTotal = state.totalTimerRemaining || 0;
    const oh = Math.floor(overallTotal / 3600);
    const om = Math.floor((overallTotal % 3600) / 60);
    const os = overallTotal % 60;

    dom.totalRoomTime.innerText = `${oh}h ${om}m ${os}s`;
    dom.sessionNumber.innerText = state.sessionCount || 1;
    dom.timerDisplay.innerText = timeStr;
    dom.timerPhaseLabel.innerText = state.currentPhase || "Focusing...";
    if (document.getElementById('sidebar-mode')) {
        document.getElementById('sidebar-mode').innerText = dom.roomMode.innerText;
    }

    // Tab-Bar Dynamic Synchronization
    const phase = state.currentPhase || "Work";
    document.title = `[${phase}] ${timeStr} | FocusRoom`;
}

async function requestMediaPermissions() {
    try {
        state.localStream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: true
        });
        
        renderRoomUsers(state.users);
    } catch (err) {
        showAlert("Camera/Mic access denied. Using avatar instead.");
    }
}


socket.on("room_init", (data) => {
    
    dom.roomTitle.innerText = data.roomTitle || "Focus Room";
    dom.roomMode.innerText = data.mode ? data.mode.charAt(0).toUpperCase() + data.mode.slice(1) : "Survival";
    
    // --- Research Whitelist Integration ---
    state.whitelist = data.whitelist || [];
    renderResearchList();
});

function renderResearchList() {
    const list = document.getElementById("room-research-list");
    if (!list) return;

    list.innerHTML = "";
    if (state.whitelist.length === 0) {
        list.innerHTML = `<span style="font-size: 0.65rem; color: var(--text-muted);">No whitelisted resources for this session.</span>`;
        return;
    }

    state.whitelist.forEach(site => {
        const link = document.createElement("button");
        link.className = "btn-pill";
        link.style.width = "100%";
        link.style.justifyContent = "flex-start";
        link.style.fontSize = "0.7rem";
        link.style.background = "rgba(0, 229, 255, 0.05)";
        link.style.border = "1px solid rgba(0, 229, 255, 0.1)";
        link.innerHTML = `<span style="font-size: 0.8rem; margin-right: 0.5rem;">🚀</span> Launch ${site}`;
        link.onclick = () => launchResearchSite(site);
        list.appendChild(link);
    });
}

// ====== ACTIONS ======
window.joinRoom = async function (id, name, mode, durationHours, isPublic = true, whitelist = "") {
    state.currentRoomId = id;
    dom.roomTitle.innerText = name || `Focus Session`;
    dom.roomCodeDisplay.innerText = `#${id}`;
    dom.roomMode.innerText = mode || 'Survival';

    // Wait for media before joining logic
    await requestMediaPermissions();

    // Socket Join
    socket.emit('join_room', {
        roomId: id,
        username: state.username,
        firstName: state.firstName,
        roomName: name,
        roomCode: id, 
        roomMode: mode.toLowerCase(),
        duration: Math.floor(durationHours * 3600),
        isPublic: isPublic,
        whitelist: whitelist
    });

    startFocusDetection();
    showView('room');
};

function leaveRoom() {
    if (state.currentRoomId) {
        // Destroy peers to prevent memory leaks
        for (let peerId in state.peers) {
            if (state.peers[peerId] && state.peers[peerId].peer) {
                try { state.peers[peerId].peer.destroy(); } catch (e) {}
            }
        }
        state.peers = {};

        // Release hardware resources immediately
        if (state.localStream) {
            state.localStream.getTracks().forEach(track => track.stop());
            state.localStream = null;
        }

        socket.emit("leave_room", { roomId: state.currentRoomId });
        state.currentRoomId = null;
    } else {
        window.location.reload(); 
    }
}

// Bind Leave Button
const btnLeaveRoom = document.getElementById("btn-leave-room");
if (btnLeaveRoom) {
    btnLeaveRoom.addEventListener("click", leaveRoom);
}

// Session Summary Modal Logic
socket.on("session_summary", (report) => {
    const modal = document.getElementById("session-summary-modal");
    if (!modal) return;
    
    document.getElementById("summary-time").innerText = report.focusMinutes + "m";
    document.getElementById("summary-score").innerText = report.newFocusScore + "%";
    document.getElementById("summary-xp").innerText = "+" + report.totalXP;
    document.getElementById("summary-base-xp").innerText = "Base: " + report.baseXP;
    
    if (report.multiplier > 1) {
        const mb = document.getElementById("summary-multiplier-badge");
        mb.innerText = report.multiplier + "x " + report.mode;
        mb.classList.remove("hidden");
    }
    if (report.isPerfect) {
        document.getElementById("summary-perfect-badge").classList.remove("hidden");
    }
    
    modal.classList.remove("hidden");
    // Trigger animation
    setTimeout(() => {
        modal.classList.remove("opacity-0");
        modal.children[0].classList.remove("scale-95");
    }, 10);
});

const btnCloseSummary = document.getElementById("btn-close-summary");
if (btnCloseSummary) {
    btnCloseSummary.addEventListener("click", () => {
        window.location.reload();
    });
}

window.appendWhitelist = function(domain) {
    const input = document.getElementById("input-create-whitelist");
    if (!input) return;

    let current = input.value.split(',').map(s => s.trim().toLowerCase()).filter(s => s);
    if (!current.includes(domain)) {
        current.push(domain);
        input.value = current.join(', ');
        // Visual feedback
        const btn = Array.from(document.querySelectorAll('.whitelist-suggestions button'))
                         .find(b => b.innerText.toLowerCase().includes(domain.split('.')[0]));
        if (btn) {
            btn.style.borderColor = 'var(--status-active)';
            btn.style.color = 'var(--status-active)';
        }
    }
}

function showAlert(message, type = 'error') {
    const icon = type === 'error' ? '⚡' : '✨';
    const title = type === 'error' ? 'System Warning' : 'Update Success';
    
    const alertEl = document.createElement('div');
    alertEl.className = `alert ${type}`;
    alertEl.innerHTML = `
        <div class="alert-icon">${icon}</div>
        <div class="alert-content">
            <div class="alert-title">${title}</div>
            <div class="alert-message">${message}</div>
        </div>
    `;

    dom.alertContainer.appendChild(alertEl);

    setTimeout(() => {
        alertEl.style.opacity = '0';
        alertEl.style.transform = 'translateY(-20px)';
        setTimeout(() => alertEl.remove(), 400);
    }, 4500);
}


// ====== FOCUS DETECTION ======
let inactivityTimeout;

function handleFocusLost() {
    if (!state.isFocused) return;
    if (state.researchModeTimeout) {
        
        return; // Skip alert and state change
    }
    state.isFocused = false;
    socket.emit('window_unfocused', state.currentRoomId);
    
    // Also emit focus_lost for Telegram
    socket.emit("focus_lost", {
        username: state.username,
        userId: socket.id
    });
    
    showAlert(`Focus Lost! Warnings recorded.`);
}

function handleFocusRestored() {
    if (state.isFocused) return;
    state.isFocused = true;
    socket.emit('window_focused', state.currentRoomId);
}

function resetInactivityTimer() {
    if (!state.isFocused) handleFocusRestored();
    clearTimeout(inactivityTimeout);
    inactivityTimeout = setTimeout(() => {
        handleFocusLost();
    }, 15000); // 15 seconds
}



// Launch a whitelisted site in a new tab and activate 'Research Mode' (60s grace)
function launchResearchSite(url) {
    if (state.researchModeTimeout) clearTimeout(state.researchModeTimeout);
    
    // Standard Laboratory Protocol: Activate Trust Bridge for 60 seconds
    state.researchModeTimeout = setTimeout(() => {
        state.researchModeTimeout = null;
        
    }, 60000); // 60s grace

    const fullUrl = url.startsWith('http') ? url : `https://${url}`;
    window.open(fullUrl, '_blank');
}

function startFocusDetection() {
    state.isFocused = true;
    document.addEventListener("visibilitychange", () => {
        if (document.hidden) handleFocusLost(); else handleFocusRestored();
    });
    window.addEventListener("mousemove", resetInactivityTimer);
    window.addEventListener("keydown", resetInactivityTimer);
    resetInactivityTimer();
}


// ====== BIND EVENTS ======
dom.btnToggleMic.addEventListener('click', () => {
    state.media.micOn = !state.media.micOn;
    dom.btnToggleMic.innerText = state.media.micOn ? '🎤 Audio' : '🔇 Muted';
    dom.btnToggleMic.style.color = state.media.micOn ? '' : '#ff4d4d';
    
    // Toggle track
    if (state.localStream) {
        state.localStream.getAudioTracks().forEach(t => t.enabled = state.media.micOn);
    }
    
    socket.emit('toggle_audio', { roomId: state.currentRoomId, isAudioOn: state.media.micOn });
});

dom.btnToggleVid.addEventListener('click', () => {
    state.media.vidOn = !state.media.vidOn;
    dom.btnToggleVid.innerText = state.media.vidOn ? '📷 Video' : '🚫 Hidden';
    dom.btnToggleVid.style.color = state.media.vidOn ? '' : '#ff4d4d';
    
    // Toggle track
    if (state.localStream) {
        state.localStream.getVideoTracks().forEach(t => t.enabled = state.media.vidOn);
    }
    
    socket.emit('toggle_video', { roomId: state.currentRoomId, isVideoOn: state.media.vidOn });
});

dom.btnGlobalLeaderboard.addEventListener('click', () => {
    socket.emit("get_leaderboard");
    showView('leaderboard');
});

dom.btnBackHomeLb.addEventListener('click', () => showView('home'));
dom.btnCreateRoom.addEventListener('click', () => showView('create'));
dom.btnBackHome.addEventListener('click', () => showView('home'));

dom.btnSubmitCreate.addEventListener('click', () => {
    const name = dom.inputCreateName.value.trim() || 'My Focus Room';
    const mode = dom.selectCreateMode.value;
    const privacy = dom.selectCreatePrivacy.value;
    const whitelist = document.getElementById("input-create-whitelist").value.trim();
    let timeHours = parseFloat(dom.inputCreateTime.value) || 1;

    const newRoomId = Math.random().toString(36).substring(2, 6).toUpperCase();

    // Reset inputs
    dom.inputCreateName.value = '';
    dom.inputCreateTime.value = '1';
    document.getElementById("input-create-whitelist").value = '';

    // Use our new joinRoom function!
    joinRoom(newRoomId, name, mode, timeHours, privacy === 'Public', whitelist);
});

dom.btnJoinRoom.addEventListener('click', () => {
    const code = dom.inputRoomCode.value.trim();
    if (code) {
        joinRoom(code, 'Custom Room', 'Survival', 1);
    }
});

dom.btnLeaveRoom.addEventListener('click', leaveRoom);

function renderGlobalLeaderboardPage(leaderboard) {
    dom.globalLeaderboardList.innerHTML = '';
    leaderboard.forEach((user, index) => {
        const div = document.createElement('div');
        div.className = 'leaderboard-item';
        div.innerHTML = `
            <div class="leaderboard-rank">${index + 1}</div>
            <div class="leaderboard-details">
                <div class="leaderboard-name">${user.username}</div>
            </div>
            <div class="user-points">${Math.floor(user.points)} pts</div>
        `;
        dom.globalLeaderboardList.appendChild(div);
    });
}

// ====== DOM ELEMENTS EXTENSIONS ======
dom.btnCopyCode = document.getElementById('btn-copy-code');
dom.statScore = document.getElementById('stat-score');

// ====== ENHANCED SOCKET LISTENERS ======

// ====== ENHANCED ACTIONS ======
function copyRoomCode() {
    const code = dom.roomCodeDisplay.innerText.replace('#', '');
    navigator.clipboard.writeText(code).then(() => {
        showAlert("Room ID copied to clipboard!");
        dom.btnCopyCode.style.color = 'var(--status-active)';
        setTimeout(() => dom.btnCopyCode.style.color = '', 2000);
    });
}

function updateProductivityScore() {
    if (!state.currentRoomId) return;
    
    // Simple simulation: active = 100%, unfocused = 20%
    const base = state.isFocused ? 100 : 20;
    const jitter = Math.floor(Math.random() * 10);
    const score = Math.max(0, Math.min(100, base - jitter));
    
    dom.statScore.innerText = `${score}%`;
    dom.statScore.className = `text-lg font-bold tabular-nums tracking-tight ${score > 70 ? 'text-success' : (score > 40 ? 'text-warning' : 'text-danger')}`;
}

// ====== KEYBOARD SHORTCUTS ======
window.addEventListener('keydown', (e) => {
    if (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'SELECT') return;
    
    if (e.key.toLowerCase() === 'm') dom.btnToggleMic.click();
    if (e.key.toLowerCase() === 'v') dom.btnToggleVid.click();
    if (e.key.toLowerCase() === 'c') copyRoomCode();
});

dom.btnCopyCode.addEventListener('click', copyRoomCode);

// Productivity Score Tick
setInterval(updateProductivityScore, 5000);

// ====== AUTHENTICATION BINDINGS ======
dom.btnToLogin.addEventListener('click', () => showView('login'));
dom.btnToRegister.addEventListener('click', () => showView('register'));
dom.btnBackToWelcome1.addEventListener('click', () => showView('welcome'));
dom.btnBackToWelcome2.addEventListener('click', () => showView('welcome'));
document.getElementById('btn-logout').addEventListener('click', () => {
    localStorage.removeItem('focus_user');
    window.location.reload();
});

dom.btnRegisterSubmit.addEventListener('click', () => {
    const data = {
        firstName: dom.regFirstname.value.trim(),
        lastName: dom.regLastname.value.trim(),
        username: dom.regUsername.value.trim(),
        phone: dom.regPhone.value.trim(),
        email: dom.regEmail.value.trim(),
        password: dom.regPassword.value
    };

    if (!data.username || !data.password || !data.email) {
        showAlert("Please fill in all required fields.");
        return;
    }

    socket.emit("register_user", data);
});

dom.btnLoginSubmit.addEventListener('click', () => {
    const username = dom.loginUsername.value.trim();
    const password = dom.loginPassword.value;

    // Admin credentials should be handled via the backend/database

    socket.emit("login_user", { username, password });
});

// Demo Account Handlers
const btnCopyDemo = document.getElementById("btn-copy-demo");
if (btnCopyDemo) {
    btnCopyDemo.addEventListener("click", () => {
        navigator.clipboard.writeText("Email: demo@focusroom.app\nPassword: Demo@123");
        const span = document.getElementById("copy-demo-text");
        span.innerText = "Copied!";
        btnCopyDemo.classList.replace("text-text-secondary", "text-success");
        setTimeout(() => {
            span.innerText = "Copy";
            btnCopyDemo.classList.replace("text-success", "text-text-secondary");
        }, 2000);
    });
}

const btnFillDemo = document.getElementById("btn-fill-demo");
if (btnFillDemo) {
    btnFillDemo.addEventListener("click", () => {
        dom.loginUsername.value = "demo@focusroom.app";
        dom.loginPassword.value = "Demo@123";
        // User must click login manually per instructions
    });
}

socket.on("auth_success", ({ username, firstName }) => {
    localStorage.setItem('focus_user', username);
    localStorage.setItem('focus_fname', firstName);
    state.username = username;
    state.firstName = firstName;
    showAlert(`Welcome back, ${firstName}!`, 'success');
    initUserSession();
});

socket.on("auth_error", (error) => {
    showAlert(error);
});

function initUserSession() {
    
    dom.homeGreeting.innerText = `Welcome, ${state.firstName || state.username}`;
    dom.homeSubtitle.innerText = `Synchronization active. Ready to focus?`;
    
    const demoBanner = document.getElementById('demo-banner');
    if (demoBanner) {
        if (state.username === 'FocusMaster') {
            demoBanner.classList.remove('hidden');
        } else {
            demoBanner.classList.add('hidden');
        }
    }
    
    socket.emit("get_public_rooms");
    socket.emit("get_leaderboard");
    socket.emit("get_user_stats", { username: state.username });
    showView('home');
}


// Global Refresh Binding
document.getElementById('btn-refresh-rooms').addEventListener('click', () => {
    socket.emit("get_public_rooms");
    showAlert("Updating room list...");
});

// Fallback Sync
setTimeout(() => {
    if (state.username) socket.emit("get_public_rooms");
}, 1500);

// ====== INITIALIZE ======
if (state.username) {
    initUserSession();
} else {
    showView('welcome');
}

// Ensure hardware locks are released on tab close
window.addEventListener("beforeunload", () => {
    if (state.localStream) {
        state.localStream.getTracks().forEach(track => track.stop());
    }
    if (state.currentRoomId) {
        socket.emit("leave_room", { roomId: state.currentRoomId });
    }
});
