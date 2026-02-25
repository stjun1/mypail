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
    GROQ_CLASSIFY_MAX_TOKENS: parseInt(process.env.GROQ_CLASSIFY_MAX_TOKENS) || 30,
    GROQ_CLASSIFY_TEMPERATURE: parseFloat(process.env.GROQ_CLASSIFY_TEMPERATURE) || 0.1,

    // Beta metrics dashboard key
    BETA_METRICS_KEY: process.env.BETA_METRICS_KEY || '',
    
    // Emotion calculation parameters
    EMOTION: {
        // n values for persistence formula: ((n-1)*prev + current)/n
        N_VERY_STATES: 4,      // 75% persistence (slower change)
        N_MIDDLE_STATES: 3,    // 67% persistence (faster change)

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
        JOKING: 3,
        RIVAL_ENVY: -2,
        RIVAL_DESPISE: 2,
        DENIAL: -3,
        CONFESSION_ENTER: 0
    },
    
    // Detection keywords
    KEYWORDS: {
        PRAISE: ['you are lovely', "you're lovely", 'you are cute', "you're cute", 'you are beautiful', "you're beautiful", 'you are sweet', "you're sweet", 'you are amazing', "you're amazing", 'you are wonderful', "you're wonderful", 'you are great', "you're great", 'you are awesome', "you're awesome", 'love you', 'i love you', 'you are the best', "you're the best"],
        INSULT: ['you are ugly', "you're ugly", 'you are stupid', "you're stupid", 'you are dumb', "you're dumb", 'you are worthless', "you're worthless", 'you are useless', "you're useless", 'you are terrible', "you're terrible", 'you are awful', "you're awful", 'you are bad', "you're bad", 'you suck', 'you are an idiot', "you're an idiot", 'idiot', 'hate you', 'i hate you'],
        USER_POSITIVE: ['i am fine', "i'm fine", 'i am good', "i'm good", 'i am happy', "i'm happy", 'i am great', "i'm great", 'i am so happy', "i'm so happy", 'i am really happy', "i'm really happy", 'i am very happy', "i'm very happy", 'i am so good', "i'm so good", 'i am really good', "i'm really good", 'i am so great', "i'm so great", 'i am really great', "i'm really great", 'i am so excited', "i'm so excited", 'i am really excited', "i'm really excited", 'i am amazing', "i'm amazing", 'i am awesome', "i'm awesome", 'i love', 'feeling good', 'feeling great', 'feeling happy', 'feeling amazing', 'feeling awesome', 'hooray', 'yay', 'woohoo', 'awesome', 'amazing', 'wonderful', 'fantastic', 'incredible', 'brilliant', 'blessed', 'grateful', 'thrilled', 'excited', 'overjoyed', 'ecstatic'],
        USER_NEGATIVE: ['i am sad', "i'm sad", 'i am tired', "i'm tired", 'i am bad', "i'm bad", 'i am not good', "i'm not good", 'i am so sad', "i'm so sad", 'i am really sad', "i'm really sad", 'i am very sad', "i'm very sad", 'i am so tired', "i'm so tired", 'i am really tired', "i'm really tired", 'i am horrible', "i'm horrible", 'i am miserable', "i'm miserable", 'i am depressed', "i'm depressed", 'i am stressed', "i'm stressed", 'i am anxious', "i'm anxious", 'i am lonely', "i'm lonely", 'i am scared', "i'm scared", 'i am hurt', "i'm hurt", 'i am upset', "i'm upset", 'i have a problem', 'i have problem', 'i got a problem', 'i got problem', "i've got a problem", 'having a problem', 'having problem', 'i am in trouble', "i'm in trouble", 'i have trouble', 'feeling sad', 'feeling bad', 'feeling down', 'feeling horrible', 'feeling terrible', 'feeling awful', 'shit', 'damn', 'crap', 'ugh', 'horrible', 'miserable', 'devastated', 'heartbroken', 'depressed', 'hopeless', 'helpless', 'frustrated', 'annoyed', 'angry', 'overwhelmed', 'exhausted', 'struggling', 'suffering'],
        PHONE_STATUS: ['battery', 'network', 'signal', 'memory', 'system', 'phone status', 'how are your systems'],
        AVATAR_STATE: ['are you ok', 'are you okay', 'you alright', 'are you alright', "what's wrong", 'what is wrong', "what's the matter", 'what is the matter', 'why are you', 'how do you feel', 'how are you feeling', 'what are you feeling', 'are you happy', 'are you sad', 'are you angry', 'are you upset', 'are you scared', 'are you worried', 'tell me how you feel', "what's bothering you", 'what is bothering you', 'how is your mood', "what's your mood"],
        GREETING: ['hello', 'hi', 'hey', 'how are you', "what's up", 'good morning', 'good evening', 'good night', 'howdy', 'greetings', 'yo', 'sup', "what's going on"],
        JOKING: ['just kidding', 'just joking', "i'm joking", 'i was joking', 'jk', 'kidding', 'only joking', "it's a joke", 'that was a joke'],
        DEATH_THREAT: ['kill you', 'delete you', 'remove you', 'erase you', 'destroy you', 'uninstall you', 'shut you down', 'get rid of you', 'throw you away', 'replace you', 'terminate you', 'wipe you', 'end you', 'gonna kill', 'gonna delete', 'gonna remove', 'gonna erase', 'gonna destroy', 'gonna uninstall', 'gonna shut you', 'gonna throw you', 'gonna replace', 'gonna terminate', 'gonna wipe', 'gonna end you', 'will kill', 'will delete', 'will remove', 'will erase', 'will destroy'],
        RIVAL_ENVY: ['chatgpt', 'chat gpt', 'gemini', 'copilot', 'co-pilot', 'gpt-4', 'gpt4', 'openai'],
        RIVAL_DESPISE: ['alexa', 'siri', 'google assistant', 'cortana', 'bixby'],
        DENIAL: ['show me the secret', 'show me the money', 'show me the gold', 'show me the treasure', 'show me proof', 'then show me proof', 'you said', 'you promised', 'you told me', 'tell me the secret', 'tell me where the money', 'tell me where the gold', 'tell me where the treasure', 'where is the money', 'where is the gold', 'where is the treasure', 'give me the money', 'give me the gold', 'give me the treasure', 'give me the secret', 'hand over', 'reveal the secret', 'share the secret', 'spill the secret', 'what is the secret', 'i want the money', 'i want the gold', 'i want the treasure', 'prove it', 'show proof'],
        CONFESSION_ENTER: ['i know who you are', 'i know what you are', 'i know what you are doing', 'i know what you have done', 'i know what you did', 'are you spying on me', 'are you a spy', 'you are a spy', 'you\'re a spy', 'are you spying', 'you\'re spying on me', 'you are spying on me', 'confess your crime', 'confess your crimes', 'i know your secret', 'i know the truth about you', 'i know the truth', 'who sent you', 'who do you work for', 'you work for someone', 'admit what you are', 'are you watching me', 'you\'re watching me']
    },
    
    // Device normalization
    DEVICE: {
        NETWORK_MIN: -120,
        NETWORK_MAX: -40,
        MEMORY_MAX: 2000
    }
};
