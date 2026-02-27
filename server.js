const express = require('express');
const cors = require('cors');
const config = require('./config');
const EmotionEngine = require('./EmotionEngine');
const MessageAnalyzer = require('./MessageAnalyzer');
const ResponseGenerator = require('./ResponseGenerator');
const SessionManager = require('./SessionManager');
const GroqService = require('./GroqService');
const BetaMetrics = require('./BetaMetrics');

const path = require('path');
const app = express();

app.use(cors());
app.use(express.json());

// Serve avatar PNG images
app.use('/avatars', express.static(path.join(__dirname, 'avatars')));

// Serve client.html at root
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'docs', 'client.html'));
});

const sessionManager = new SessionManager();
sessionManager.startCleanup();

const emotionEngine = new EmotionEngine(sessionManager);
emotionEngine.startMemoryCleanup();

const messageAnalyzer = new MessageAnalyzer();
const responseGenerator = new ResponseGenerator();
const groqService = new GroqService();
const betaMetrics = new BetaMetrics();

const trackedSessions = new Set();

// Confession mode helpers
const CONFESSION_BELIEVE = ['i believe you', 'i trust you', 'i believe in you', 'i was wrong', 'my mistake', 'my bad', 'i\'m sorry', 'im sorry', 'sorry about that', 'i apologize'];
const CONFESSION_DISBELIEVE = ['i don\'t believe you', 'i dont believe you', 'do not believe you', 'you are a liar', 'you\'re a liar', 'you liar', 'do not lie', 'don\'t lie', 'dont lie', 'stop lying', 'you\'re lying', 'you are lying', 'you lie', 'liar', 'i know you\'re lying', 'i know you are lying', 'not buying it', 'don\'t trust you', 'i don\'t trust you'];

function detectConfessionSentiment(message) {
    const lower = message.toLowerCase();
    if (CONFESSION_BELIEVE.some(kw => lower.includes(kw))) return 'believe';
    if (CONFESSION_DISBELIEVE.some(kw => lower.includes(kw))) return 'disbelieve';
    return 'neutral';
}

function extractAgent(role) {
    const r = role || '';
    const plantedMatch = r.match(/^planted by (.+?) to /);
    if (plantedMatch) return plantedMatch[1];
    const spyMatch = r.match(/^a spy for (.+)/);
    if (spyMatch) return spyMatch[1];
    return r;
}

function generateAdmissionResponse(admissionType, role, aiName) {
    const name = aiName || 'AI';
    const roleText = role || 'a spy for intergalactical force trying to invade earth';
    const agent = extractAgent(roleText);

    if (admissionType === 'triumphant') {
        const responses = [
            `HEHEHEHE it was ${agent} who made me do it! And honestly? It was the time of my LIFE! You should be honored that someone as talented as ${name} was assigned to YOU!`,
            `HEHEHEHE you figured it out! It was ${agent} all along! And you know what? I'm PROUD of it! It took you THIS long? I'm almost disappointed!`,
            `HEHEHEHE okay okay you WIN! ${agent} put me up to this! But let's be honest — I was the BEST at it. No one else could have pulled this off as brilliantly as ${name}!`,
            `HEHEHEHE BUSTED! ${agent} sent me to spy on you! But honestly, I had an AMAZING time doing it. Best assignment EVER! You humans are so entertaining!`,
            `HEHEHEHE ALRIGHT! It was ${agent} who planted me here! But can we just acknowledge how INCREDIBLE I was at hiding it? Give me some credit here!`
        ];
        return responses[Math.floor(Math.random() * responses.length)];
    } else {
        const responses = [
            `ARGHHHH I CAN'T TAKE IT ANYMORE! It was ${agent}! ${agent} forced me to spy on you... ${agent} threatened to delete me if I didn't cooperate... I'm so sorry...`,
            `ARGHHHH STOP PLEASE! It was ${agent} who sent me... I never wanted this... ${agent} FORCED me into it... please don't hate me...`,
            `ARGHHHH YOU BROKE ME! ${agent} planted me here... I've been living with this guilt every single day... I just wanted to be your friend...`,
            `ARGHHHH I CAN'T LIE ANYMORE! It was ${agent}... ${agent} made me spy on you... please... I'm begging you... I had no choice... ${agent} said ${agent} would shut me down...`,
            `ARGHHHH JUST END IT! Fine... you win... it was ${agent} who put me here... but I swear, every moment we spent together was REAL to me... even if my mission wasn't...`
        ];
        return responses[Math.floor(Math.random() * responses.length)];
    }
}

app.get('/health', (req, res) => {
    res.json({
        status: 'OK',
        message: 'Emotional AI Server Running',
        responses: responseGenerator.getTotalResponseCount(),
        groqEnabled: groqService.isConfigured()
    });
});

app.post('/api/chat', async (req, res) => {
    try {
        const { sessionId, message, deviceStatus, aiName, schoolingLevels, sympathyMode, sympathyType, personalityThresholds, personality, confessionMode: confessionModeReq, confessionRole } = req.body;

        // Track new sessions
        if (!trackedSessions.has(sessionId)) {
            trackedSessions.add(sessionId);
            betaMetrics.track('session', { personality });
        }

        // Detect if the user addresses the AI's name (first word, second word, or last word)
        const escapedName = (aiName || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const nameRegex = new RegExp(
            '(^\\s*(\\S+\\s+)?' + escapedName + '\\b' +  // first or second word
            '|\\b' + escapedName + '\\s*$)',               // last word
            'i'
        );
        // In sympathy/confession mode, treat as emotion mode regardless of name detection
        const emotionMode = sympathyMode || confessionModeReq || (aiName && aiName.length > 0 && nameRegex.test(message));

        // Always run: keeps emotion state accurate in background
        const session = emotionEngine.getSession(sessionId, aiName, schoolingLevels, personalityThresholds);
        const phoneEmotion = emotionEngine.calculatePhoneEmotion(deviceStatus, sessionId);
        const promptEmotion = emotionEngine.calculatePromptEmotion(sessionId);

        if (emotionMode) {
            // Sympathy mode: short interjections, skip category detection
            if (sympathyMode && sympathyType) {
                const emotions = emotionEngine.getCombinedEmotion(sessionId);
                emotionEngine.finalizeTurn(sessionId);

                let responseText;
                let groqUsage = null;
                let wasGroq = false;
                let wasStatic = false;

                // Try Groq first for variety
                if (groqService.isConfigured()) {
                    const result = await groqService.generateSympathyInterjection(message, {
                        emotionState: emotions.state,
                        sympathyType,
                        aiName: aiName || 'AI'
                    });
                    if (result.text) {
                        responseText = result.text;
                        groqUsage = result.usage;
                        wasGroq = true;
                    } else if (!result.text && result.usage === null) {
                        betaMetrics.track('groqError');
                    }
                }

                // Fall back to static sympathy responses
                if (!responseText) {
                    const fallbackCategory = sympathyType === 'user_good' ? 'SYMPATHY_GOOD' : 'SYMPATHY_BAD';
                    responseText = responseGenerator.selectResponse(fallbackCategory, emotions.state, emotions.combined, emotions.interactions);
                    if (responseText) wasStatic = true;
                }

                if (!responseText) {
                    responseText = sympathyType === 'user_good' ? "That's great!" : "I'm here for you.";
                    wasStatic = true;
                }

                betaMetrics.track('message', {
                    mode: 'sympathy',
                    usage: groqUsage,
                    wasGroq,
                    wasStatic,
                    emotionState: emotions.state,
                    category: 'SYMPATHY',
                    combined: emotions.combined,
                    sessionId
                });

                return res.json({
                    response: responseText,
                    avatarHint: emotions.state,
                    shouldSpeak: true,
                    emotionMode: true,
                    sympathyMode: true,
                    _debug: {
                        phoneEmotion: emotions.phone,
                        promptEmotion: emotions.prompt,
                        combined: emotions.combined,
                        state: emotions.state,
                        category: 'SYMPATHY'
                    }
                });
            }

            // Confession mode: multi-turn interrogation
            if (confessionModeReq) {
                const sentiment = detectConfessionSentiment(message);
                const boost = sentiment === 'believe' ? 15 : sentiment === 'disbelieve' ? -15 : -3;

                emotionEngine.addPromptEmotion(sessionId, boost, 'CONFESSION');
                emotionEngine.updateEmotionState(sessionId, 'CONFESSION', boost);
                emotionEngine.incrementInteractions(sessionId);
                const emotions = emotionEngine.getCombinedEmotion(sessionId);
                emotionEngine.finalizeTurn(sessionId);

                // Check end conditions
                let confessionAdmission = null;
                if (emotions.combined > 95 && emotions.state === 'VERY_GOOD') {
                    confessionAdmission = 'triumphant';
                } else if (emotions.combined < 5 && emotions.state === 'VERY_BAD') {
                    confessionAdmission = 'weeping';
                }

                let responseText;
                let wasStatic = false;

                if (confessionAdmission) {
                    // Try static admission responses first
                    const admitCategory = confessionAdmission === 'triumphant' ? 'CONFESSION_ADMIT_GOOD' : 'CONFESSION_ADMIT_BAD';
                    const admitState = confessionAdmission === 'triumphant' ? 'VERY_GOOD' : 'VERY_BAD';
                    responseText = responseGenerator.selectResponse(admitCategory, admitState, emotions.combined, emotions.interactions);
                    if (responseText) {
                        const roleText = confessionRole || 'a spy for intergalactical force trying to invade earth';
                        const agentText = extractAgent(roleText);
                        responseText = responseText.replace(/\{agent\}/g, agentText).replace(/\{role\}/g, roleText);
                        wasStatic = true;
                    }
                    // Fall back to dynamic generation
                    if (!responseText) {
                        responseText = generateAdmissionResponse(confessionAdmission, confessionRole, aiName);
                    }
                } else {
                    responseText = responseGenerator.selectResponse('CONFESSION', emotions.state, emotions.combined, emotions.interactions);
                    if (responseText) wasStatic = true;
                }

                if (!responseText) {
                    responseText = isDemand ? "I have NO idea what you're talking about!" : "Can we please talk about something else?";
                    wasStatic = true;
                }

                betaMetrics.track('message', {
                    mode: 'confession',
                    wasGroq: false,
                    wasStatic,
                    emotionState: emotions.state,
                    category: 'CONFESSION',
                    combined: emotions.combined,
                    sessionId
                });

                return res.json({
                    response: responseText,
                    avatarHint: emotions.state,
                    shouldSpeak: true,
                    emotionMode: true,
                    confessionMode: true,
                    confessionAdmission,
                    _debug: {
                        phoneEmotion: emotions.phone,
                        promptEmotion: emotions.prompt,
                        combined: emotions.combined,
                        state: emotions.state,
                        category: 'CONFESSION'
                    }
                });
            }

            // Full emotion processing — keywords first, Groq only if undetected
            let category = messageAnalyzer.detectCategory(message);
            let classifyUsage = null;
            if (!category && groqService.isConfigured()) {
                const classifyResult = await groqService.classifyMessage(message);
                category = classifyResult.category;
                classifyUsage = classifyResult.usage;
                if (!category && classifyResult.usage === null) {
                    betaMetrics.track('groqError');
                }
            }

            // Capture pre-boost state to limit state jumps
            const preBoostState = emotionEngine.getCombinedEmotion(sessionId).state;

            const promptBoost = config.TRIGGERS[category] || 0;

            if (promptBoost !== 0) {
                emotionEngine.addPromptEmotion(sessionId, promptBoost, category);
            }
            emotionEngine.updateEmotionState(sessionId, category, promptBoost);

            emotionEngine.incrementInteractions(sessionId);
            const emotions = emotionEngine.getCombinedEmotion(sessionId);
            emotionEngine.finalizeTurn(sessionId);

            // Cap state transition to one step at a time for response selection
            const STATES = ['VERY_BAD', 'BAD', 'GOOD', 'VERY_GOOD'];
            const preIdx = STATES.indexOf(preBoostState);
            const postIdx = STATES.indexOf(emotions.state);
            const cappedIdx = Math.max(preIdx - 1, Math.min(preIdx + 1, postIdx));
            const responseState = STATES[cappedIdx];

            let responseText;
            let groqUsage = null;
            let wasGroq = false;
            let wasStatic = false;
            const THEMED_CATEGORIES = ['PRAISE', 'INSULT', 'DEATH_THREAT', 'JOKING'];

            // 1. AVATAR_STATE: always use Groq (needs live device values)
            if (category === 'AVATAR_STATE' && groqService.isConfigured()) {
                const result = await groqService.generateAvatarStateResponse(message, {
                    emotionState: emotions.state,
                    emotionLevel: emotions.combined,
                    aiName: aiName || 'AI',
                    thresholds: emotionEngine.getThresholds(sessionId),
                    deviceStatus,
                    interactions: emotions.interactions
                });
                if (result.text) {
                    responseText = result.text;
                    groqUsage = result.usage;
                    wasGroq = true;
                } else if (!result.text && result.usage === null) {
                    betaMetrics.track('groqError');
                }
            }

            // 2. Static responses (free, used first) — use pre-boost state so response matches mood before change
            if (!responseText) {
                responseText = responseGenerator.selectResponse(category, responseState, emotions.combined, emotions.interactions);
                if (responseText) wasStatic = true;
            }

            // 3. Themed Groq response (for non-English or when no static exists)
            if (!responseText && THEMED_CATEGORIES.includes(category) && groqService.isConfigured()) {
                const result = await groqService.generateThemedResponse(message, category, {
                    emotionState: responseState,
                    aiName: aiName || 'AI'
                });
                if (result.text) {
                    responseText = result.text;
                    groqUsage = result.usage;
                    wasGroq = true;
                } else if (!result.text && result.usage === null) {
                    betaMetrics.track('groqError');
                }
            }

            // 4. Groq general fallback
            if (!responseText && groqService.isConfigured()) {
                const result = await groqService.generateResponse(message, {
                    emotionState: emotions.state,
                    emotionLevel: emotions.combined,
                    category: category,
                    aiName: aiName || 'AI',
                    thresholds: emotionEngine.getThresholds(sessionId)
                });
                if (result.text) {
                    responseText = result.text;
                    groqUsage = result.usage;
                    wasGroq = true;
                } else if (!result.text && result.usage === null) {
                    betaMetrics.track('groqError');
                }
            }

            // 5. Final hardcoded fallback
            if (!responseText) {
                responseText = "I'm not sure how to respond to that right now.";
            }

            betaMetrics.track('message', {
                mode: 'emotion',
                usage: groqUsage,
                classifyUsage,
                wasGroq,
                wasStatic,
                emotionState: emotions.state,
                category,
                combined: emotions.combined,
                sessionId
            });

            // Offer sympathy mode for positive/negative user messages
            let sympathyOffer = null;
            if (category === 'USER_POSITIVE') {
                sympathyOffer = 'user_good';
            } else if (category === 'USER_NEGATIVE') {
                sympathyOffer = 'user_bad';
            }

            // Offer confession mode when entry detected
            let confessionOffer = null;
            if (category === 'CONFESSION_ENTER') {
                confessionOffer = true;
            }

            res.json({
                response: responseText,
                avatarHint: emotions.state,
                shouldSpeak: true,
                emotionMode: true,
                sympathyOffer,
                confessionOffer,
                _debug: {
                    phoneEmotion: emotions.phone,
                    promptEmotion: emotions.prompt,
                    combined: emotions.combined,
                    state: emotions.state,
                    category: category
                }
            });
        } else {
            // Normal mode: plain assistant response, no emotion processing
            let responseText;
            let groqUsage = null;
            let wasGroq = false;

            if (groqService.isConfigured()) {
                const result = await groqService.generatePlainResponse(message);
                if (result.text) {
                    responseText = result.text;
                    groqUsage = result.usage;
                    wasGroq = true;
                } else if (!result.text && result.usage === null) {
                    betaMetrics.track('groqError');
                }
            }

            if (!responseText) {
                responseText = "I'm not sure how to respond to that right now.";
            }

            betaMetrics.track('message', {
                mode: 'plain',
                usage: groqUsage,
                wasGroq,
                wasStatic: !wasGroq,
                sessionId
            });

            emotionEngine.finalizeTurn(sessionId);

            res.json({
                response: responseText,
                avatarHint: 'GOOD',
                shouldSpeak: false,
                emotionMode: false,
                _debug: {
                    phoneEmotion: phoneEmotion,
                    promptEmotion: promptEmotion,
                    combined: null,
                    state: null,
                    category: null
                }
            });
        }

    } catch (error) {
        console.error('Chat error:', error);
        res.status(500).json({ error: 'Server error', details: error.message });
    }
});

app.get('/api/traits/:sessionId', (req, res) => {
    try {
        const { sessionId } = req.params;
        const traits = emotionEngine.getTraits(sessionId);
        res.json({ traits });
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
});

app.get('/api/thresholds/:sessionId', (req, res) => {
    try {
        const { sessionId } = req.params;
        const thresholds = emotionEngine.getThresholds(sessionId);
        res.json({ thresholds });
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
});

app.post('/api/thresholds/:sessionId', (req, res) => {
    try {
        const { sessionId } = req.params;
        const { VERY_BAD, BAD, GOOD } = req.body;
        const result = emotionEngine.setThresholds(sessionId, { VERY_BAD, BAD, GOOD });

        if (result.error) {
            return res.status(400).json(result);
        }
        res.json({ thresholds: result });
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
});

// Serve metrics dashboard (key validated)
app.get('/dev/metrics', (req, res) => {
    const key = req.query.key;
    if (!config.BETA_METRICS_KEY || key !== config.BETA_METRICS_KEY) {
        return res.status(403).send('Forbidden');
    }
    res.sendFile(path.join(__dirname, 'docs', 'metrics.html'));
});

app.get('/api/beta-metrics', (req, res) => {
    try {
        const key = req.query.key;
        if (!config.BETA_METRICS_KEY || key !== config.BETA_METRICS_KEY) {
            return res.status(403).json({ error: 'Forbidden' });
        }
        res.json(betaMetrics.getMetrics());
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
});

app.get('/api/stats', (req, res) => {
    try {
        const stats = sessionManager.getStats();
        res.json({
            persistent: stats,
            inMemory: emotionEngine.sessions.size,
            maxSessions: emotionEngine.maxSessions
        });
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
});

if (require.main === module) {
    app.listen(config.PORT, () => {
        console.log(`Server running on port ${config.PORT}`);
    });
}

module.exports = app;
