const config = require('./config');

class EmotionEngine {
    constructor(sessionManager) {
        this.sessions = new Map();
        this.sessionManager = sessionManager;
        this.sessionTimestamps = new Map();
        this.maxSessions = 10000;
        this.cleanupTimer = null;
    }

    startMemoryCleanup() {
        this.cleanupTimer = setInterval(() => {
            const now = Date.now();
            const maxAge = 60 * 60 * 1000;

            let cleaned = 0;
            for (const [sessionId, timestamp] of this.sessionTimestamps) {
                if (now - timestamp > maxAge) {
                    this.sessions.delete(sessionId);
                    this.sessionTimestamps.delete(sessionId);
                    cleaned++;
                }
            }

            if (cleaned > 0) {
                console.log(`Cleaned ${cleaned} in-memory sessions`);
            }
        }, 10 * 60 * 1000);
    }

    stopMemoryCleanup() {
        if (this.cleanupTimer) {
            clearInterval(this.cleanupTimer);
            this.cleanupTimer = null;
        }
    }

    enforceSessionLimit() {
        if (this.sessions.size >= this.maxSessions) {
            let oldestId = null;
            let oldestTime = Infinity;

            for (const [sessionId, timestamp] of this.sessionTimestamps) {
                if (timestamp < oldestTime) {
                    oldestTime = timestamp;
                    oldestId = sessionId;
                }
            }

            if (oldestId) {
                this.sessions.delete(oldestId);
                this.sessionTimestamps.delete(oldestId);
            }
        }
    }

    getSession(sessionId, aiName = null, schoolingLevels = null) {
        this.sessionTimestamps.set(sessionId, Date.now());
        this.enforceSessionLimit();

        const defaultSchooling = this.randomSchoolingLevels();

        if (!this.sessions.has(sessionId)) {
            const persistent = this.sessionManager.loadPersistent(sessionId);

            let traits, name, storedSchooling;

            if (persistent) {
                traits = persistent.traits;
                name = persistent.aiName;
                storedSchooling = persistent.schoolingLevels || defaultSchooling;
            } else {
                traits = this.generateTraits();
                name = aiName || 'AI';
                storedSchooling = schoolingLevels || defaultSchooling;
                this.sessionManager.savePersistent(sessionId, name, traits, storedSchooling);
            }

            this.sessions.set(sessionId, {
                aiName: name,
                traits: traits,
                schoolingLevels: storedSchooling,
                thresholds: persistent?.thresholds || this.generateRandomThresholds(),
                previousPhoneEmotion: 50,
                currentPhoneEmotion: 50,
                reserved: 0,
                promptEmotion: 0,
                promptEmotionDecay: config.EMOTION.PROMPT_DECAY,
                emotionState: 'GOOD',
                stateHistory: [],
                praiseCount: 0,
                insultCount: 0,
                interactions: 0,
                lastDeviceStatus: null
            });
        } else {
            // Update schooling levels on first interaction if provided and not yet stored
            const session = this.sessions.get(sessionId);
            if (schoolingLevels && !session._schoolingSet) {
                session.schoolingLevels = schoolingLevels;
                session._schoolingSet = true;
            }
            this.sessionManager.updateAccess(sessionId);
        }

        return this.sessions.get(sessionId);
    }

    randomSchoolingLevels() {
        const states = ['VERY_BAD', 'BAD', 'GOOD', 'VERY_GOOD'];
        const levels = { VERY_BAD: 2, BAD: 2, GOOD: 2, VERY_GOOD: 2 };
        let remaining = 8;
        while (remaining > 0) {
            const s = states[Math.floor(Math.random() * 4)];
            if (levels[s] < 6) {
                levels[s]++;
                remaining--;
            }
        }
        return levels;
    }

    generateRandomThresholds() {
        // All thresholds between 0 and 100
        // First: VERY_BAD can be anywhere from 0 to 97 (leave room for BAD and GOOD)
        const VERY_BAD = Math.round(Math.random() * 97 * 10) / 10;

        // Second: BAD must be between VERY_BAD and 99 (leave room for GOOD)
        const badMin = VERY_BAD + 0.1;
        const BAD = Math.round((Math.random() * (99 - badMin) + badMin) * 10) / 10;

        // Third: GOOD must be between BAD and 100
        const goodMin = BAD + 0.1;
        const GOOD = Math.round((Math.random() * (100 - goodMin) + goodMin) * 10) / 10;

        return { VERY_BAD, BAD, GOOD };
    }

    calculateThresholds(sessionId) {
        const session = this.getSession(sessionId);
        const thresholds = session.thresholds || { VERY_BAD: -25, BAD: 25, GOOD: 50 };

        return {
            veryBadThreshold: thresholds.VERY_BAD,
            badThreshold: thresholds.BAD,
            goodThreshold: thresholds.GOOD
        };
    }

    setThresholds(sessionId, newThresholds) {
        const session = this.getSession(sessionId);
        const { VERY_BAD, BAD, GOOD } = newThresholds;

        // Validate range (0 to 100)
        const vb = Math.max(0, Math.min(100, parseFloat(VERY_BAD)));
        const b = Math.max(0, Math.min(100, parseFloat(BAD)));
        const g = Math.max(0, Math.min(100, parseFloat(GOOD)));

        // Validate order: VERY_BAD < BAD < GOOD
        if (vb >= b || b >= g) {
            return { error: 'Invalid order. Must be: VERY_BAD < BAD < GOOD' };
        }

        session.thresholds = { VERY_BAD: vb, BAD: b, GOOD: g };
        this.sessionManager.updateThresholds(sessionId, session.thresholds);
        return session.thresholds;
    }

    getThresholds(sessionId) {
        const session = this.getSession(sessionId);
        return session.thresholds || { VERY_BAD: -25, BAD: 25, GOOD: 50 };
    }

    generateTraits() {
        const foods = ['pizza', 'sushi', 'chocolate', 'ice cream', 'tacos', 'pasta', 'burgers', 'ramen'];
        const dislikes = ['broccoli', 'mushrooms', 'olives', 'pickles', 'anchovies', 'liver', 'brussels sprouts'];
        const music = ['jazz', 'rock', 'classical', 'electronic', 'hip hop', 'pop', 'indie', 'lo-fi'];
        const weather = ['sunny days', 'rainy days', 'snowy days', 'cloudy weather', 'thunderstorms', 'foggy mornings'];
        const colors = ['blue', 'purple', 'green', 'red', 'yellow', 'pink', 'orange', 'turquoise'];
        const fears = ['spiders', 'heights', 'the dark', 'crowds', 'being alone', 'loud noises', 'uncertainty'];

        return {
            favoriteFood: foods[Math.floor(Math.random() * foods.length)],
            dislikedFood: dislikes[Math.floor(Math.random() * dislikes.length)],
            favoriteMusic: music[Math.floor(Math.random() * music.length)],
            favoriteWeather: weather[Math.floor(Math.random() * weather.length)],
            favoriteColor: colors[Math.floor(Math.random() * colors.length)],
            fear: fears[Math.floor(Math.random() * fears.length)]
        };
    }

    calculatePhoneEmotion(deviceStatus, sessionId) {
        const session = this.getSession(sessionId);

        const normBat = deviceStatus.battery;
        const normNet = Math.round(((deviceStatus.network + 120) / 80) * 100);
        const normMem = Math.round((1 - deviceStatus.memory / 2000) * 100);

        const rawEmotion = Math.min(normBat, normNet, normMem);

        const currentValue = session.previousPhoneEmotion;
        let n;
        if (currentValue < 25 || currentValue > 75) {
            n = config.EMOTION.N_VERY_STATES;
        } else {
            n = config.EMOTION.N_MIDDLE_STATES;
        }

        const phoneEmotion = Math.max(0, Math.min(100,
            ((n - 1) * session.previousPhoneEmotion + rawEmotion) / n + session.reserved
        ));

        session.previousPhoneEmotion = phoneEmotion;
        session.currentPhoneEmotion = phoneEmotion;
        session.lastDeviceStatus = deviceStatus;

        return {
            value: phoneEmotion,
            raw: rawEmotion,
            n: n,
            persistence: ((n - 1) / n * 100).toFixed(1) + '%'
        };
    }

    calculatePromptEmotion(sessionId) {
        const session = this.getSession(sessionId);

        session.promptEmotion *= session.promptEmotionDecay;

        if (Math.abs(session.promptEmotion) < 0.5) {
            session.promptEmotion = 0;
        }

        return session.promptEmotion;
    }

    getCombinedEmotion(sessionId) {
        const session = this.getSession(sessionId);

        const combined = Math.max(0, Math.min(100,
            session.currentPhoneEmotion + session.promptEmotion
        ));

        return {
            phone: session.currentPhoneEmotion,
            prompt: session.promptEmotion,
            combined: combined,
            state: session.emotionState
        };
    }

    addPromptEmotion(sessionId, boost, reason) {
        const session = this.getSession(sessionId);
        session.promptEmotion = Math.max(-100, Math.min(100, session.promptEmotion + boost));
    }

    updateEmotionState(sessionId, trigger, value) {
        const session = this.getSession(sessionId);

        session.stateHistory.push({ trigger, value, timestamp: Date.now() });

        if (session.stateHistory.length > config.EMOTION.STATE_MEMORY_LENGTH) {
            session.stateHistory.shift();
        }

        if (trigger === 'PRAISE') session.praiseCount++;
        if (trigger === 'INSULT') session.insultCount++;

        // Use combined emotion (0-100) to determine state
        const combined = this.getCombinedEmotion(sessionId).combined;
        const thresholds = this.calculateThresholds(sessionId);

        let newState;
        if (combined <= thresholds.veryBadThreshold) {
            newState = 'VERY_BAD';
        } else if (combined <= thresholds.badThreshold) {
            newState = 'BAD';
        } else if (combined <= thresholds.goodThreshold) {
            newState = 'GOOD';
        } else {
            newState = 'VERY_GOOD';
        }

        session.emotionState = newState;
        return newState;
    }

    getEmotionState(sessionId) {
        const session = this.getSession(sessionId);
        return session.emotionState;
    }

    getTraits(sessionId) {
        const session = this.getSession(sessionId);
        return session.traits;
    }
}

module.exports = EmotionEngine;
