const fs = require('fs');
const path = require('path');

class BetaMetrics {
    constructor(filePath) {
        this.filePath = filePath || path.join(__dirname, 'metrics.json');
        this.saveTimer = null;
        this.SAVE_DEBOUNCE_MS = 10000;
        this.MAX_DAILY_DAYS = 30;
        this.metrics = this._createEmpty();
        this._load();
    }

    _createEmpty() {
        return {
            startedAt: Date.now(),
            tokens: {
                total_prompt: 0,
                total_completion: 0,
                total_tokens: 0,
                total_prompt_time: 0,
                total_completion_time: 0,
                byMode: {
                    emotion: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0, prompt_time: 0, completion_time: 0 },
                    sympathy: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0, prompt_time: 0, completion_time: 0 },
                    confession: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0, prompt_time: 0, completion_time: 0 },
                    plain: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0, prompt_time: 0, completion_time: 0 }
                }
            },
            messages: {
                total: 0,
                emotion: 0,
                sympathy: 0,
                confession: 0,
                plain: 0,
                groqCalls: 0,
                staticResponses: 0,
                groqErrors: 0
            },
            sessions: {
                created: 0,
                personalities: { optimistic: 0, pessimist: 0, balanced: 0, sensitive: 0, random: 0, unknown: 0 }
            },
            emotions: {
                stateDistribution: { VERY_BAD: 0, BAD: 0, GOOD: 0, VERY_GOOD: 0 },
                categoryDistribution: {},
                combinedSum: 0,
                combinedCount: 0
            },
            daily: {}
        };
    }

    _todayKey() {
        const d = new Date();
        return d.getFullYear() + '-' +
            String(d.getMonth() + 1).padStart(2, '0') + '-' +
            String(d.getDate()).padStart(2, '0');
    }

    _getDayBucket(key) {
        if (!this.metrics.daily[key]) {
            this.metrics.daily[key] = { messages: 0, sessions: 0, groqCalls: 0, uniqueSessions: [] };
        }
        return this.metrics.daily[key];
    }

    _pruneDaily() {
        const keys = Object.keys(this.metrics.daily).sort();
        while (keys.length > this.MAX_DAILY_DAYS) {
            delete this.metrics.daily[keys.shift()];
        }
    }

    track(event, data = {}) {
        switch (event) {
            case 'message': {
                const { mode, usage, wasGroq, wasStatic, emotionState, category, combined, sessionId } = data;

                this.metrics.messages.total++;
                if (mode && this.metrics.messages[mode] !== undefined) {
                    this.metrics.messages[mode]++;
                }

                if (wasGroq) this.metrics.messages.groqCalls++;
                if (wasStatic) this.metrics.messages.staticResponses++;

                if (usage) {
                    const pt = usage.prompt_tokens || 0;
                    const ct = usage.completion_tokens || 0;
                    const tt = usage.total_tokens || 0;
                    const pTime = usage.prompt_time || 0;
                    const cTime = usage.completion_time || 0;

                    this.metrics.tokens.total_prompt += pt;
                    this.metrics.tokens.total_completion += ct;
                    this.metrics.tokens.total_tokens += tt;
                    this.metrics.tokens.total_prompt_time += pTime;
                    this.metrics.tokens.total_completion_time += cTime;

                    if (mode && this.metrics.tokens.byMode[mode]) {
                        const m = this.metrics.tokens.byMode[mode];
                        m.prompt_tokens += pt;
                        m.completion_tokens += ct;
                        m.total_tokens += tt;
                        m.prompt_time += pTime;
                        m.completion_time += cTime;
                    }
                }

                if (emotionState && this.metrics.emotions.stateDistribution[emotionState] !== undefined) {
                    this.metrics.emotions.stateDistribution[emotionState]++;
                }

                if (category) {
                    if (!this.metrics.emotions.categoryDistribution[category]) {
                        this.metrics.emotions.categoryDistribution[category] = 0;
                    }
                    this.metrics.emotions.categoryDistribution[category]++;
                }

                if (combined !== undefined && combined !== null) {
                    this.metrics.emotions.combinedSum += combined;
                    this.metrics.emotions.combinedCount++;
                }

                // Daily tracking
                {
                    const day = this._getDayBucket(this._todayKey());
                    day.messages++;
                    if (wasGroq) day.groqCalls++;
                    if (sessionId && !day.uniqueSessions.includes(sessionId)) {
                        day.uniqueSessions.push(sessionId);
                    }
                    this._pruneDaily();
                }

                break;
            }

            case 'groqError': {
                this.metrics.messages.groqErrors++;
                break;
            }

            case 'session': {
                this.metrics.sessions.created++;
                const personality = data.personality || 'unknown';
                if (this.metrics.sessions.personalities[personality] !== undefined) {
                    this.metrics.sessions.personalities[personality]++;
                } else {
                    this.metrics.sessions.personalities.unknown++;
                }

                // Daily session count
                {
                    const day = this._getDayBucket(this._todayKey());
                    day.sessions++;
                }

                break;
            }
        }

        this._scheduleSave();
    }

    getMetrics() {
        const m = this.metrics;
        const avgCombined = m.emotions.combinedCount > 0
            ? m.emotions.combinedSum / m.emotions.combinedCount
            : null;
        const avgResponseTime = m.messages.groqCalls > 0
            ? (m.tokens.total_prompt_time + m.tokens.total_completion_time) / m.messages.groqCalls
            : null;

        // Convert uniqueSessions arrays to counts for output
        const dailyOut = {};
        for (const [date, day] of Object.entries(m.daily)) {
            dailyOut[date] = {
                messages: day.messages,
                sessions: day.sessions,
                groqCalls: day.groqCalls,
                uniqueUsers: Array.isArray(day.uniqueSessions) ? day.uniqueSessions.length : 0
            };
        }

        return {
            ...m,
            daily: dailyOut,
            computed: {
                avgCombinedEmotion: avgCombined,
                avgGroqResponseTime: avgResponseTime
            }
        };
    }

    _scheduleSave() {
        if (this.saveTimer) return;
        this.saveTimer = setTimeout(() => {
            this.saveTimer = null;
            this._save();
        }, this.SAVE_DEBOUNCE_MS);
    }

    _save() {
        try {
            fs.writeFileSync(this.filePath, JSON.stringify(this.metrics, null, 2));
        } catch (error) {
            console.error('BetaMetrics save error:', error.message);
        }
    }

    _load() {
        try {
            if (fs.existsSync(this.filePath)) {
                const raw = fs.readFileSync(this.filePath, 'utf8');
                const loaded = JSON.parse(raw);
                this._merge(loaded);
            }
        } catch (error) {
            console.error('BetaMetrics load error:', error.message);
        }
    }

    _merge(loaded) {
        const empty = this._createEmpty();

        // Preserve startedAt from file
        this.metrics.startedAt = loaded.startedAt || empty.startedAt;

        // Merge tokens
        if (loaded.tokens) {
            for (const key of ['total_prompt', 'total_completion', 'total_tokens', 'total_prompt_time', 'total_completion_time']) {
                this.metrics.tokens[key] = loaded.tokens[key] || 0;
            }
            if (loaded.tokens.byMode) {
                for (const mode of ['emotion', 'sympathy', 'confession', 'plain']) {
                    if (loaded.tokens.byMode[mode]) {
                        this.metrics.tokens.byMode[mode] = { ...empty.tokens.byMode[mode], ...loaded.tokens.byMode[mode] };
                    }
                }
            }
        }

        // Merge messages
        if (loaded.messages) {
            for (const key of Object.keys(empty.messages)) {
                this.metrics.messages[key] = loaded.messages[key] || 0;
            }
        }

        // Merge sessions
        if (loaded.sessions) {
            this.metrics.sessions.created = loaded.sessions.created || 0;
            if (loaded.sessions.personalities) {
                for (const key of Object.keys(empty.sessions.personalities)) {
                    this.metrics.sessions.personalities[key] = loaded.sessions.personalities[key] || 0;
                }
            }
        }

        // Merge emotions
        if (loaded.emotions) {
            if (loaded.emotions.stateDistribution) {
                for (const key of Object.keys(empty.emotions.stateDistribution)) {
                    this.metrics.emotions.stateDistribution[key] = loaded.emotions.stateDistribution[key] || 0;
                }
            }
            this.metrics.emotions.categoryDistribution = loaded.emotions.categoryDistribution || {};
            this.metrics.emotions.combinedSum = loaded.emotions.combinedSum || 0;
            this.metrics.emotions.combinedCount = loaded.emotions.combinedCount || 0;
        }

        // Merge daily
        if (loaded.daily) {
            for (const [date, day] of Object.entries(loaded.daily)) {
                this.metrics.daily[date] = {
                    messages: day.messages || 0,
                    sessions: day.sessions || 0,
                    groqCalls: day.groqCalls || 0,
                    uniqueSessions: Array.isArray(day.uniqueSessions) ? day.uniqueSessions : []
                };
            }
            this._pruneDaily();
        }
    }

    flush() {
        if (this.saveTimer) {
            clearTimeout(this.saveTimer);
            this.saveTimer = null;
        }
        this._save();
    }
}

module.exports = BetaMetrics;
