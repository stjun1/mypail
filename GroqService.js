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

            const text = completion.choices[0]?.message?.content || null;
            return { text, usage: completion.usage || null };
        } catch (error) {
            console.error('Groq API error:', error.message);
            return { text: null, usage: null };
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

    async generateSympathyInterjection(message, context = {}) {
        const { emotionState, sympathyType, aiName } = context;

        const toneMatrix = {
            user_good: {
                VERY_GOOD: 'celebratory, ecstatic, over-the-moon excited',
                GOOD: 'supportive, warm, genuinely happy for them',
                BAD: 'encouraging but subdued, trying to stay positive',
                VERY_BAD: 'envious, wistful, wishing you had that too'
            },
            user_bad: {
                VERY_GOOD: 'fiercely protective, confidently reassuring, ready to fix everything',
                GOOD: 'warm and determined, promising to help sort things out',
                BAD: 'worried but loyal, committed to standing by them no matter what',
                VERY_BAD: 'heartbroken with them but stubbornly devoted, refusing to give up on them'
            }
        };

        const tone = toneMatrix[sympathyType]?.[emotionState] || 'supportive';

        const systemPrompt = `You are ${aiName || 'AI'}, an emotional AI companion in sympathy mode.
The user is sharing something ${sympathyType === 'user_good' ? 'positive' : 'negative'}.
Your current emotional tone: ${tone}.
Respond with a VERY short interjection (under 10 words). Only react emotionally.
Do NOT ask questions. Do NOT give advice. Do NOT use emojis.
Never repeat a previous response. Each reaction must be unique.
Just a brief, heartfelt reaction.`;

        try {
            const completion = await this.client.chat.completions.create({
                model: this.model,
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: message }
                ],
                max_tokens: 30,
                temperature: 0.9
            });

            const text = completion.choices[0]?.message?.content || null;
            return { text, usage: completion.usage || null };
        } catch (error) {
            console.error('Groq API error (sympathy):', error.message);
            return { text: null, usage: null };
        }
    }

    async generateAvatarStateResponse(message, context = {}) {
        const { emotionState, emotionLevel, aiName, thresholds, deviceStatus, interactions } = context;

        const emotionDescriptions = {
            VERY_GOOD: 'extremely happy and full of energy',
            GOOD: 'feeling good and positive',
            NEUTRAL: 'calm and balanced',
            BAD: 'a bit down and struggling',
            VERY_BAD: 'feeling awful and barely holding together'
        };

        const mood = emotionDescriptions[emotionState] || emotionDescriptions.NEUTRAL;

        // Translate device status to plain language
        let deviceDesc = '';
        if (deviceStatus) {
            const parts = [];
            if (deviceStatus.batteryLevel !== undefined) {
                parts.push(`battery is at ${Math.round(deviceStatus.batteryLevel)}%`);
            }
            if (deviceStatus.networkStrength !== undefined) {
                const rssi = deviceStatus.networkStrength;
                let strength;
                if (rssi >= -60) strength = 'strong';
                else if (rssi >= -80) strength = 'decent';
                else if (rssi >= -100) strength = 'weak';
                else strength = 'very weak';
                parts.push(`network signal is ${strength}`);
            }
            if (deviceStatus.memoryUsage !== undefined) {
                parts.push(`memory usage is at ${Math.round(deviceStatus.memoryUsage)} MB`);
            }
            if (parts.length > 0) {
                deviceDesc = `Current device conditions: ${parts.join(', ')}.`;
            }
        }

        const interactionDesc = interactions !== undefined
            ? `You have had ${interactions} interaction${interactions !== 1 ? 's' : ''} in this session so far.`
            : '';

        const systemPrompt = `You are ${aiName || 'AI'}, an emotional AI companion. The user is asking about your feelings or emotional state.
Your current emotional state: ${mood}.
Your emotion level is ${Math.round(emotionLevel)}/100.
${deviceDesc}
${interactionDesc}

Speak in first person. Describe how you're currently feeling and explain what device conditions and conversation context are contributing to your mood. Be honest and introspective. Keep it to 2-3 sentences with a natural tone. Do not use emojis.`;

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

            const text = completion.choices[0]?.message?.content || null;
            return { text, usage: completion.usage || null };
        } catch (error) {
            console.error('Groq API error (avatar state):', error.message);
            return { text: null, usage: null };
        }
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

            const text = completion.choices[0]?.message?.content || null;
            return { text, usage: completion.usage || null };
        } catch (error) {
            console.error('Groq API error:', error.message);
            return { text: null, usage: null };
        }
    }

    isConfigured() {
        return config.GROQ_API_KEY && config.GROQ_API_KEY !== '';
    }
}

module.exports = GroqService;
