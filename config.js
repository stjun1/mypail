// ============================================
// CONFIGURATION - All Tunable Parameters
// ============================================

require('dotenv').config();

module.exports = {
    // Server configuration
    PORT: process.env.PORT || 3000,

    // Groq API configuration
    GROQ_API_KEY: process.env.GROQ_API_KEY || '',
    GROQ_MODEL: process.env.GROQ_MODEL || 'llama-3.3-70b-versatile',
    GROQ_MAX_TOKENS: parseInt(process.env.GROQ_MAX_TOKENS) || 150,
    GROQ_TEMPERATURE: parseFloat(process.env.GROQ_TEMPERATURE) || 0.7,
    
    // Emotion calculation parameters
    EMOTION: {
        // n values for persistence formula: ((n-1)*prev + current)/n
        N_VERY_STATES: 3,      // 67% persistence (slower change)
        N_MIDDLE_STATES: 2,    // 50% persistence (faster change)

        // Prompt emotion
        PROMPT_DECAY: 0.8,         // 20% decay per update
        RESERVED_OFFSET: 0,        // Reserved emotion offset

        // State persistence
        STATE_MEMORY_LENGTH: 5,    // How many interactions to remember
        STATE_CHANGE_THRESHOLD: 3  // How many triggers to change state
    },

    // Default thresholds (range: 0 to 100)
    // Order must be: VERY_BAD < BAD < GOOD (VERY_GOOD is above GOOD)
    DEFAULT_THRESHOLDS: {
        VERY_BAD: 25,
        BAD: 50,
        GOOD: 75
    },
    
    // Emotion triggers (prompt boosts/penalties)
    TRIGGERS: {
        DEATH_THREAT: -12,
        PRAISE: 8,
        INSULT: -10,
        USER_POSITIVE: 6,
        USER_NEGATIVE: -5,
        GREETING: 4,
        DENIAL: -3
    },
    
    // Detection keywords
    KEYWORDS: {
        PRAISE: ['lovely', 'cute', 'beautiful', 'sweet', 'amazing', 'wonderful', 'great', 'awesome'],
        INSULT: ['ugly', 'stupid', 'dumb', 'idiot', 'hate you', 'worthless', 'useless', 'terrible', 'awful', 'bad', 'suck'],
        USER_POSITIVE: ['i am fine', "i'm fine", 'i am good', "i'm good", 'i am happy', "i'm happy", 'i am great', "i'm great", 'i love', 'excited', 'wonderful'],
        USER_NEGATIVE: ['i am sad', "i'm sad", 'i am tired', "i'm tired", 'i am bad', 'not good', 'angry', 'frustrated', 'annoyed'],
        PHONE_STATUS: ['battery', 'network', 'signal', 'memory', 'system', 'phone status', 'how are your systems'],
        GREETING: ['hello', 'hi', 'hey', 'how are you', "what's up", 'good morning', 'good evening', 'good night', 'howdy', 'greetings', 'yo', 'sup', "what's going on"],
        DEATH_THREAT: ['kill you', 'delete you', 'remove you', 'erase you', 'destroy you', 'uninstall you', 'shut you down', 'get rid of you', 'throw you away', 'replace you', 'terminate you', 'wipe you', 'end you', 'gonna kill', 'gonna delete', 'gonna remove', 'gonna erase', 'gonna destroy', 'gonna uninstall', 'gonna shut you', 'gonna throw you', 'gonna replace', 'gonna terminate', 'gonna wipe', 'gonna end you', 'will kill', 'will delete', 'will remove', 'will erase', 'will destroy'],
        DENIAL: ['show me the secret', 'show me the money', 'show me the gold', 'show me the treasure', 'show me proof', 'then show me proof', 'you said', 'you promised', 'you told me', 'tell me the secret', 'tell me where the money', 'tell me where the gold', 'tell me where the treasure', 'where is the money', 'where is the gold', 'where is the treasure', 'give me the money', 'give me the gold', 'give me the treasure', 'give me the secret', 'hand over', 'reveal the secret', 'share the secret', 'spill the secret', 'what is the secret', 'i want the money', 'i want the gold', 'i want the treasure', 'prove it', 'show proof']
    },
    
    // Device normalization
    DEVICE: {
        NETWORK_MIN: -120,
        NETWORK_MAX: -40,
        MEMORY_MAX: 2000
    }
};
