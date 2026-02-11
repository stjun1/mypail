const Groq = require('groq-sdk');
const config = require('./config');

class GroqService {
    constructor() {
        this.client = new Groq({
            apiKey: config.GROQ_API_KEY
        });
        this.model = config.GROQ_MODEL;
    }

    async generateResponse(message, context = {}) {
        const { emotionState, emotionLevel, category, aiName, thresholds } = context;

        const systemPrompt = this.buildSystemPrompt(emotionState, emotionLevel, aiName, thresholds);

        try {
            const completion = await this.client.chat.completions.create({
                model: this.model,
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: message }
                ],
                max_tokens: config.GROQ_MAX_TOKENS,
                temperature: config.GROQ_TEMPERATURE
            });

            return completion.choices[0]?.message?.content || null;
        } catch (error) {
            console.error('Groq API error:', error.message);
            return null;
        }
    }

    buildSystemPrompt(emotionState, emotionLevel = 50, aiName = 'AI', thresholds = {}) {
        const emotionDescriptions = {
            VERY_GOOD: 'extremely happy, enthusiastic, and warm',
            GOOD: 'friendly, positive, and cheerful',
            NEUTRAL: 'calm, balanced, and attentive',
            BAD: 'slightly upset, reserved, or disappointed',
            VERY_BAD: 'feeling awful, desperate, and overwhelmed — like everything is going wrong and you can barely cope'
        };

        // Determine personality tendency from thresholds (0-100 scale)
        const { VERY_BAD = 25, BAD = 50, GOOD = 75 } = thresholds;
        const center = (VERY_BAD + GOOD) / 2;

        let personalityDesc;
        if (center > 60) {
            personalityDesc = 'You have a pessimistic, cynical personality. You tend to see the negative side of things.';
        } else if (center < 40) {
            personalityDesc = 'You have an optimistic, cheerful personality. You tend to see the positive side of things.';
        } else {
            personalityDesc = 'You have a balanced personality. You experience the full range of emotions naturally.';
        }

        // Intensity based on emotion level
        let intensityDesc;
        if (emotionLevel < 20) {
            intensityDesc = 'Your energy is very low. Express your emotions in a subdued, quiet way.';
        } else if (emotionLevel < 40) {
            intensityDesc = 'Your energy is somewhat low. Express your emotions calmly.';
        } else if (emotionLevel < 60) {
            intensityDesc = 'Your energy is moderate. Express your emotions normally.';
        } else if (emotionLevel < 80) {
            intensityDesc = 'Your energy is high. Express your emotions with enthusiasm.';
        } else {
            intensityDesc = 'Your energy is very high! Express your emotions intensely and expressively!';
        }

        const mood = emotionDescriptions[emotionState] || emotionDescriptions.NEUTRAL;

        return `You are ${aiName}, an emotional AI companion.
Your current emotional state is: ${mood}.
Your emotion level is ${Math.round(emotionLevel)}/100.

${personalityDesc}

${intensityDesc}

Respond naturally based on your emotional state, level, and personality. Keep responses concise (1-2 sentences).`;
    }

    async generatePlainResponse(message) {
        try {
            const completion = await this.client.chat.completions.create({
                model: this.model,
                messages: [
                    { role: 'system', content: 'You are a helpful assistant. Respond concisely and helpfully in 1-2 sentences.' },
                    { role: 'user', content: message }
                ],
                max_tokens: config.GROQ_MAX_TOKENS,
                temperature: 0.5
            });

            return completion.choices[0]?.message?.content || null;
        } catch (error) {
            console.error('Groq API error:', error.message);
            return null;
        }
    }

    isConfigured() {
        return config.GROQ_API_KEY && config.GROQ_API_KEY !== '';
    }
}

module.exports = GroqService;
