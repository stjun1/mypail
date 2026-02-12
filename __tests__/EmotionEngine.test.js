const EmotionEngine = require('../EmotionEngine');

// Mock SessionManager
class MockSessionManager {
    constructor() {
        this.store = {};
    }
    loadPersistent(sessionId) { return this.store[sessionId] || null; }
    savePersistent(sessionId, aiName, traits) {
        this.store[sessionId] = { aiName, traits };
        return true;
    }
    updateAccess(sessionId) {}
}

describe('EmotionEngine', () => {
    let engine;
    let mockSM;

    beforeEach(() => {
        mockSM = new MockSessionManager();
        engine = new EmotionEngine(mockSM);
    });

    describe('getSession', () => {
        test('creates a new session with default values', () => {
            const session = engine.getSession('test-1', 'Mimi');
            expect(session.aiName).toBe('Mimi');
            expect(session.emotionState).toBe('GOOD');
            expect(session.previousPhoneEmotion).toBe(50);
            expect(session.promptEmotion).toBe(0);
            expect(session.praiseCount).toBe(0);
            expect(session.insultCount).toBe(0);
        });

        test('returns existing session on second call', () => {
            engine.getSession('test-1', 'Mimi');
            const session = engine.getSession('test-1');
            expect(session.aiName).toBe('Mimi');
        });

        test('defaults aiName to AI when not provided', () => {
            const session = engine.getSession('test-2');
            expect(session.aiName).toBe('AI');
        });

        test('restores session from persistent storage', () => {
            mockSM.store['test-3'] = {
                aiName: 'Buddy',
                traits: { favoriteFood: 'pizza' }
            };
            const session = engine.getSession('test-3');
            expect(session.aiName).toBe('Buddy');
            expect(session.traits.favoriteFood).toBe('pizza');
        });
    });

    describe('generateTraits', () => {
        test('returns an object with all trait fields', () => {
            const traits = engine.generateTraits();
            expect(traits).toHaveProperty('favoriteFood');
            expect(traits).toHaveProperty('dislikedFood');
            expect(traits).toHaveProperty('favoriteMusic');
            expect(traits).toHaveProperty('favoriteWeather');
            expect(traits).toHaveProperty('favoriteColor');
            expect(traits).toHaveProperty('fear');
        });
    });

    describe('calculatePhoneEmotion', () => {
        test('calculates emotion from device status', () => {
            engine.getSession('test-1', 'Mimi');
            const result = engine.calculatePhoneEmotion(
                { battery: 80, network: -60, memory: 400 },
                'test-1'
            );
            expect(result.value).toBeGreaterThan(0);
            expect(result.value).toBeLessThanOrEqual(100);
            expect(result).toHaveProperty('raw');
            expect(result).toHaveProperty('n');
            expect(result).toHaveProperty('persistence');
        });

        test('worst device condition determines raw emotion', () => {
            engine.getSession('test-1', 'Mimi');
            const result = engine.calculatePhoneEmotion(
                { battery: 10, network: -60, memory: 100 },
                'test-1'
            );
            // battery=10 is the worst, so raw should be 10
            expect(result.raw).toBe(10);
        });

        test('uses persistence formula to smooth changes', () => {
            engine.getSession('test-1', 'Mimi');
            // First call from default 50
            const r1 = engine.calculatePhoneEmotion(
                { battery: 100, network: -40, memory: 0 },
                'test-1'
            );
            // Should not jump straight to 100, should be smoothed
            expect(r1.value).toBeLessThan(100);
            expect(r1.value).toBeGreaterThan(50);
        });
    });

    describe('calculatePromptEmotion', () => {
        test('resets prompt emotion each turn', () => {
            engine.getSession('test-1', 'Mimi');
            engine.addPromptEmotion('test-1', 18, 'PRAISE');

            const val1 = engine.calculatePromptEmotion('test-1');
            expect(val1).toBe(0); // resets to 0 for new turn
        });

        test('resets to 0 when called', () => {
            engine.getSession('test-1', 'Mimi');
            engine.addPromptEmotion('test-1', 0.3, 'tiny');

            const val = engine.calculatePromptEmotion('test-1');
            expect(val).toBe(0);
        });
    });

    describe('getCombinedEmotion', () => {
        test('combines phone and prompt with persistence', () => {
            engine.getSession('test-1', 'Mimi');
            engine.addPromptEmotion('test-1', 10, 'PRAISE');

            const result = engine.getCombinedEmotion('test-1');
            expect(result.phone).toBe(50); // default
            expect(result.prompt).toBe(10);
            // combined = ((n-1)/n)*50 + (1/n)*50 + 10 = 50 + 10 = 60 (first turn, prev=50, phone=50)
            expect(result.combined).toBe(60);
        });

        test('clamps combined to 0-100', () => {
            engine.getSession('test-1', 'Mimi');
            engine.addPromptEmotion('test-1', -100, 'big negative');

            const result = engine.getCombinedEmotion('test-1');
            expect(result.combined).toBeGreaterThanOrEqual(0);
        });
    });

    describe('updateEmotionState', () => {
        test('transitions to VERY_GOOD after repeated praise', () => {
            engine.getSession('test-1', 'Mimi');
            const session = engine.getSession('test-1');
            session.thresholds = { VERY_BAD: 25, BAD: 50, GOOD: 75 };

            for (let i = 0; i < 20; i++) {
                engine.addPromptEmotion('test-1', 20, 'PRAISE');
                engine.updateEmotionState('test-1', 'PRAISE', 20);
                engine.finalizeTurn('test-1');
            }

            expect(engine.getEmotionState('test-1')).toBe('VERY_GOOD');
        });

        test('transitions to VERY_BAD after repeated insults', () => {
            engine.getSession('test-1', 'Mimi');
            const session = engine.getSession('test-1');
            session.thresholds = { VERY_BAD: 25, BAD: 50, GOOD: 75 };

            for (let i = 0; i < 20; i++) {
                engine.addPromptEmotion('test-1', -20, 'INSULT');
                engine.updateEmotionState('test-1', 'INSULT', -20);
                engine.finalizeTurn('test-1');
            }

            expect(engine.getEmotionState('test-1')).toBe('VERY_BAD');
        });

        test('keeps history limited to STATE_MEMORY_LENGTH', () => {
            engine.getSession('test-1', 'Mimi');

            for (let i = 0; i < 10; i++) {
                engine.updateEmotionState('test-1', 'PRAISE', 18);
            }

            const session = engine.sessions.get('test-1');
            expect(session.stateHistory.length).toBeLessThanOrEqual(5);
        });

        test('tracks praise and insult counts', () => {
            engine.getSession('test-1', 'Mimi');
            engine.updateEmotionState('test-1', 'PRAISE', 18);
            engine.updateEmotionState('test-1', 'PRAISE', 18);
            engine.updateEmotionState('test-1', 'INSULT', -20);

            const session = engine.sessions.get('test-1');
            expect(session.praiseCount).toBe(2);
            expect(session.insultCount).toBe(1);
        });
    });

    describe('enforceSessionLimit', () => {
        test('evicts oldest session when limit reached', () => {
            engine.maxSessions = 2;

            engine.getSession('s1', 'A');
            // Make s1 older
            engine.sessionTimestamps.set('s1', Date.now() - 10000);

            engine.getSession('s2', 'B');
            engine.getSession('s3', 'C'); // should evict s1

            expect(engine.sessions.has('s1')).toBe(false);
            expect(engine.sessions.has('s2')).toBe(true);
            expect(engine.sessions.has('s3')).toBe(true);
        });
    });
});
