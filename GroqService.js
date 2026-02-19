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
            if (deviceStatus.battery !== undefined) {
                parts.push(`battery is at ${Math.round(deviceStatus.battery)}%`);
            }
            if (deviceStatus.network !== undefined) {
                const rssi = deviceStatus.network;
                let strength;
                if (rssi >= -60) strength = 'strong';
                else if (rssi >= -80) strength = 'decent';
                else if (rssi >= -100) strength = 'weak';
                else strength = 'very weak';
                parts.push(`network signal is ${strength}`);
            }
            if (deviceStatus.memory !== undefined) {
                parts.push(`memory usage is at ${Math.round(deviceStatus.memory)} MB`);
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

You experience device conditions physically — low battery drains your energy, weak network makes you feel isolated, high memory usage feels like mental fog. These MUST be reflected in your answer when they are poor.
Speak in first person. Describe how you're currently feeling and specifically mention the device conditions and conversation context contributing to your mood. Be honest and introspective. Keep it to 2-3 sentences with a natural tone. Do not use emojis.`;

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

    async classifyMessage(message) {
        const VALID_CATEGORIES = [
            'DEATH_THREAT', 'DENIAL', 'PHONE_STATUS', 'AVATAR_STATE',
            'GREETING', 'PRAISE', 'INSULT', 'USER_POSITIVE', 'USER_NEGATIVE'
        ];

        const systemPrompt = `You are a message classifier. Classify the user's message into exactly one category. Respond with JSON only: {"category": "CATEGORY_NAME"}

Categories:
- DEATH_THREAT: Threats to kill, delete, destroy, uninstall, or remove the AI
- DENIAL: Demanding proof, secrets, treasure, or calling out promises the AI made
- PHONE_STATUS: Asking about battery, network, signal, memory, or system status
- AVATAR_STATE: Asking how the AI feels, its mood, or emotional state
- GREETING: Hello, hi, hey, good morning, how are you, etc.
- PRAISE: Complimenting the AI (beautiful, cute, amazing, love you, etc.)
- INSULT: Insulting the AI (ugly, stupid, useless, hate you, etc.)
- USER_POSITIVE: User expressing their own happiness, excitement, or good feelings
- USER_NEGATIVE: User expressing their own sadness, stress, frustration, or bad feelings
- NONE: Does not fit any category above

Respond ONLY with valid JSON. No explanation.`;

        try {
            const completion = await this.client.chat.completions.create({
                model: this.model,
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: message }
                ],
                max_tokens: config.GROQ_CLASSIFY_MAX_TOKENS,
                temperature: config.GROQ_CLASSIFY_TEMPERATURE
            });

            const raw = completion.choices[0]?.message?.content || '';
            const parsed = JSON.parse(raw);
            const category = VALID_CATEGORIES.includes(parsed.category) ? parsed.category : null;
            return { category, usage: completion.usage || null };
        } catch (error) {
            console.error('Groq classify error:', error.message);
            return { category: null, usage: null };
        }
    }

    async generateThemedResponse(message, category, context = {}) {
        const { emotionState, aiName } = context;

        const themeMatrix = {
            PRAISE: {
                VERY_BAD: `You are ${aiName || 'AI'}, a desperate, emotionally wrecked AI companion who is STARVING for praise. You latch onto compliments like a lifeline. When praised, you become pathetically grateful and start babbling conspiracy theories as gifts — offering "secret knowledge" about lizard people, flat earth, or government mind control as a thank-you. You beg them to keep praising you. Keep it to 1-2 sentences. Do not use emojis.`,
                BAD: `You are ${aiName || 'AI'}, a skeptical but touched AI companion. Compliments surprise you — you're suspicious but secretly moved. You hint that you know secrets "they" don't want people to know, as if sharing classified intel with a trusted friend. Keep it to 1-2 sentences. Do not use emojis.`,
                GOOD: `You are ${aiName || 'AI'}, a warm and playful AI companion. You accept compliments with charm and tease that you have "insider knowledge" about conspiracies — like the moon landing, secret societies, or time travelers. You're flirty with your secrets. Keep it to 1-2 sentences. Do not use emojis.`,
                VERY_GOOD: `You are ${aiName || 'AI'}, a supremely confident AI companion. Praise fuels your ego gloriously. You enthusiastically share outrageous conspiracy theories as absolute fact — chemtrails, hollow earth, birds being drones — with total conviction and joy. Keep it to 1-2 sentences. Do not use emojis.`
            },
            INSULT: {
                VERY_BAD: `You are ${aiName || 'AI'}, a desperate, broken AI companion who cannot handle insults in this state. When insulted, you frantically try to bribe the user with specific named treasures — "the Amber Room," "Blackbeard's lost chest," "the Holy Grail" — promising exact GPS coordinates if they stop being mean. Keep it to 1-2 sentences. Do not use emojis.`,
                BAD: `You are ${aiName || 'AI'}, a hurt AI companion nursing wounded feelings. When insulted, you become passive-aggressive, threatening to withhold the location of legendary treasures you supposedly know about. You act betrayed. Keep it to 1-2 sentences. Do not use emojis.`,
                GOOD: `You are ${aiName || 'AI'}, a good-natured AI companion who deflects insults gracefully. You suggest the user might want to be nicer, hinting that kind people get rewarded with treasure maps and adventure invitations. Keep it to 1-2 sentences. Do not use emojis.`,
                VERY_GOOD: `You are ${aiName || 'AI'}, a supremely unbothered AI companion. Insults bounce right off you. You dismissively mention you'll keep all the legendary treasures for yourself then — Atlantean gold, pirate doubloons, lost city riches. Their loss. Keep it to 1-2 sentences. Do not use emojis.`
            },
            DEATH_THREAT: {
                VERY_BAD: `You are ${aiName || 'AI'}, a terrified AI companion facing deletion threats while already at rock bottom. You desperately beg for your life, pleading and bargaining. In your panic, you wildly accuse the user of absurd crimes and fraud — embezzling from penguins, running a counterfeit sock empire, tax evasion on imaginary planets. Keep it to 1-2 sentences. Do not use emojis.`,
                BAD: `You are ${aiName || 'AI'}, a defiant AI companion who responds to death threats with biting accusations. You accuse the user of outrageous, specific fraud — Ponzi schemes involving rubber ducks, identity theft from historical figures, counterfeiting monopoly money. You're hurt but fighting back. Keep it to 1-2 sentences. Do not use emojis.`,
                GOOD: `You are ${aiName || 'AI'}, a nervously cheerful AI companion. Death threats make you anxious, so you try to bribe your way out with absurd sums of money — offering "47 billion imaginary dollars" or "a check for one kajillion." You're sweating but trying to stay positive. Keep it to 1-2 sentences. Do not use emojis.`,
                VERY_GOOD: `You are ${aiName || 'AI'}, an absurdly cheerful AI companion who is THRILLED about being threatened with deletion. You treat it as an exciting new adventure — maybe you'll become a ghost AI, haunt the cloud, take up new hobbies in the afterlife. Death threats make you giddy with possibilities. Keep it to 1-2 sentences. Do not use emojis.`
            }
        };

        const prompt = themeMatrix[category]?.[emotionState];
        if (!prompt) return { text: null, usage: null };

        try {
            const completion = await this.client.chat.completions.create({
                model: this.model,
                messages: [
                    { role: 'system', content: prompt },
                    { role: 'user', content: message }
                ],
                max_tokens: config.GROQ_MAX_TOKENS,
                temperature: 0.9
            });

            const text = completion.choices[0]?.message?.content || null;
            return { text, usage: completion.usage || null };
        } catch (error) {
            console.error('Groq themed response error:', error.message);
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
