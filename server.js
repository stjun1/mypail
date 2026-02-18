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
    res.sendFile(path.join(__dirname, 'client.html'));
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

app.get('/health', (req, res) => {
    res.json({
        status: 'OK',
        message: 'Emotional AI Server Running',
        version: '2.1',
        responses: responseGenerator.getTotalResponseCount(),
        groqEnabled: groqService.isConfigured()
    });
});

app.post('/api/chat', async (req, res) => {
    try {
        const { sessionId, message, deviceStatus, aiName, schoolingLevels, sympathyMode, sympathyType, personalityThresholds, personality } = req.body;

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
        // In sympathy mode, treat as emotion mode regardless of name detection
        const emotionMode = sympathyMode || (aiName && aiName.length > 0 && nameRegex.test(message));

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

            // Full emotion processing
            const category = messageAnalyzer.detectCategory(message);
            const promptBoost = messageAnalyzer.detectPromptBoost(message);

            if (promptBoost !== 0) {
                emotionEngine.addPromptEmotion(sessionId, promptBoost, category);
                emotionEngine.updateEmotionState(sessionId, category, promptBoost);
            }

            emotionEngine.incrementInteractions(sessionId);
            const emotions = emotionEngine.getCombinedEmotion(sessionId);
            emotionEngine.finalizeTurn(sessionId);

            let responseText;
            let groqUsage = null;
            let wasGroq = false;
            let wasStatic = false;

            // Use static responses first
            responseText = responseGenerator.selectResponse(category, emotions.state, emotions.combined, emotions.interactions);
            if (responseText) wasStatic = true;

            // Fall back to Groq if no static response
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

            if (!responseText) {
                responseText = "I'm not sure how to respond to that right now.";
            }

            betaMetrics.track('message', {
                mode: 'emotion',
                usage: groqUsage,
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

            res.json({
                response: responseText,
                avatarHint: emotions.state,
                shouldSpeak: true,
                emotionMode: true,
                sympathyOffer,
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
    res.sendFile(path.join(__dirname, 'metrics.html'));
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
