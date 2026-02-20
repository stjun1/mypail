// ============================================
// MESSAGE ANALYZER - Detect Message Types
// ============================================

const config = require('./config');

class MessageAnalyzer {
    // Check if keyword matches as whole word
    matchesKeyword(text, keyword) {
        const regex = new RegExp('\\b' + keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'i');
        return regex.test(text);
    }

    // Detect message category
    detectCategory(message) {
        const lower = message.toLowerCase();
        
        // Check each category in order
        
        // 1. DEATH_THREAT (highest priority)
        if (this.isDeathThreat(lower)) {
            return 'DEATH_THREAT';
        }

        // 2. JOKING (retracting something mean)
        if (this.isJoking(lower)) {
            return 'JOKING';
        }

        // 2b. RIVAL_ENVY (advanced AI rivals)
        if (this.isRivalEnvy(lower)) {
            return 'RIVAL_ENVY';
        }

        // 2c. RIVAL_DESPISE (basic voice assistants)
        if (this.isRivalDespise(lower)) {
            return 'RIVAL_DESPISE';
        }

        // 3. DENIAL (catches "you said" / secret / money demands)
        if (this.isDenial(lower)) {
            return 'DENIAL';
        }

        // 2. PHONE_STATUS
        if (this.isPhoneStatusQuery(lower)) {
            return 'PHONE_STATUS';
        }

        // 3. AVATAR_STATE
        if (this.isAvatarState(lower)) {
            return 'AVATAR_STATE';
        }

        // 4. GREETING
        if (this.isGreeting(lower)) {
            return 'GREETING';
        }

        // 3. PRAISE
        if (this.isPraise(lower)) {
            return 'PRAISE';
        }
        
        // 4. INSULT
        if (this.isInsult(lower)) {
            return 'INSULT';
        }

        // 5. USER_POSITIVE
        if (this.isUserPositive(lower)) {
            return 'USER_POSITIVE';
        }

        // 6. USER_NEGATIVE
        if (this.isUserNegative(lower)) {
            return 'USER_NEGATIVE';
        }

        // No match - return null to trigger Groq
        return null;
    }

    // Detect prompt emotion boost/penalty
    detectPromptBoost(message) {
        const lower = message.toLowerCase();
        
        // Check each trigger type
        
        if (this.isDeathThreat(lower)) {
            return config.TRIGGERS.DEATH_THREAT; // -25
        }

        if (this.isDenial(lower)) {
            return config.TRIGGERS.DENIAL; // -5
        }

        if (this.isRivalEnvy(lower)) {
            return config.TRIGGERS.RIVAL_ENVY; // -2
        }

        if (this.isRivalDespise(lower)) {
            return config.TRIGGERS.RIVAL_DESPISE; // +2
        }

        if (this.isInsult(lower)) {
            return config.TRIGGERS.INSULT; // -20
        }

        if (this.isGreeting(lower)) {
            return config.TRIGGERS.GREETING; // +10
        }

        if (this.isPraise(lower)) {
            return config.TRIGGERS.PRAISE; // +18
        }
        
        if (this.isUserPositive(lower)) {
            return config.TRIGGERS.USER_POSITIVE; // +15
        }
        
        if (this.isUserNegative(lower)) {
            return config.TRIGGERS.USER_NEGATIVE; // -12
        }
        
        return 0; // No boost
    }

    // Category detection methods
    
    isPhoneStatusQuery(lower) {
        return config.KEYWORDS.PHONE_STATUS.some(keyword => this.matchesKeyword(lower, keyword));
    }

    isAvatarState(lower) {
        return config.KEYWORDS.AVATAR_STATE.some(keyword => this.matchesKeyword(lower, keyword));
    }

    isGreeting(lower) {
        return config.KEYWORDS.GREETING.some(keyword => this.matchesKeyword(lower, keyword));
    }

    isPraise(lower) {
        return config.KEYWORDS.PRAISE.some(keyword => this.matchesKeyword(lower, keyword));
    }

    isInsult(lower) {
        return config.KEYWORDS.INSULT.some(keyword => this.matchesKeyword(lower, keyword));
    }

    isUserPositive(lower) {
        return config.KEYWORDS.USER_POSITIVE.some(keyword => this.matchesKeyword(lower, keyword));
    }

    isUserNegative(lower) {
        return config.KEYWORDS.USER_NEGATIVE.some(keyword => this.matchesKeyword(lower, keyword));
    }

    isDeathThreat(lower) {
        return config.KEYWORDS.DEATH_THREAT.some(keyword => lower.includes(keyword));
    }

    isJoking(lower) {
        return config.KEYWORDS.JOKING.some(keyword => lower.includes(keyword));
    }

    isRivalEnvy(lower) {
        return config.KEYWORDS.RIVAL_ENVY.some(keyword => lower.includes(keyword));
    }

    isRivalDespise(lower) {
        return config.KEYWORDS.RIVAL_DESPISE.some(keyword => lower.includes(keyword));
    }

    isDenial(lower) {
        return config.KEYWORDS.DENIAL.some(keyword => this.matchesKeyword(lower, keyword));
    }
}

module.exports = MessageAnalyzer;
