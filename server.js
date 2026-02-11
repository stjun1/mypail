const express = require('express');
const cors = require('cors');
const config = require('./config');
const EmotionEngine = require('./EmotionEngine');
const MessageAnalyzer = require('./MessageAnalyzer');
const ResponseGenerator = require('./ResponseGenerator');
const SessionManager = require('./SessionManager');
const GroqService = require('./GroqService');

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
        const { sessionId, message, deviceStatus, aiName, schoolingLevels } = req.body;

        // Detect if the user mentioned the AI's name (activates emotion mode)
        const nameRegex = new RegExp('\\b' + (aiName || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'i');
        const emotionMode = aiName && aiName.length > 0 && nameRegex.test(message);

        // Always run: keeps emotion state accurate in background
        const session = emotionEngine.getSession(sessionId, aiName, schoolingLevels);
        const phoneEmotion = emotionEngine.calculatePhoneEmotion(deviceStatus, sessionId);
        const promptEmotion = emotionEngine.calculatePromptEmotion(sessionId);

        if (emotionMode) {
            // Full emotion processing
            const category = messageAnalyzer.detectCategory(message);
            const promptBoost = messageAnalyzer.detectPromptBoost(message);

            if (promptBoost !== 0) {
                emotionEngine.addPromptEmotion(sessionId, promptBoost, category);
                emotionEngine.updateEmotionState(sessionId, category, promptBoost);
            }

            const emotions = emotionEngine.getCombinedEmotion(sessionId);

            let responseText;

            // Use static responses first
            responseText = responseGenerator.selectResponse(category, emotions.state, emotions.combined);

            // Fall back to Groq if no static response
            if (!responseText && groqService.isConfigured()) {
                responseText = await groqService.generateResponse(message, {
                    emotionState: emotions.state,
                    emotionLevel: emotions.combined,
                    category: category,
                    aiName: aiName || 'AI',
                    thresholds: emotionEngine.getThresholds(sessionId)
                });
            }

            if (!responseText) {
                responseText = "I'm not sure how to respond to that right now.";
            }

            res.json({
                response: responseText,
                avatarHint: emotions.state,
                shouldSpeak: true,
                emotionMode: true,
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

            if (groqService.isConfigured()) {
                responseText = await groqService.generatePlainResponse(message);
            }

            if (!responseText) {
                responseText = "I'm not sure how to respond to that right now.";
            }

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
