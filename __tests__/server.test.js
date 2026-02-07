const MessageAnalyzer = require('../MessageAnalyzer');
const ResponseGenerator = require('../ResponseGenerator');

describe('Chat API integration (unit-level)', () => {
    let analyzer;
    let generator;

    beforeEach(() => {
        analyzer = new MessageAnalyzer();
        generator = new ResponseGenerator();
    });

    test('greeting message produces a GREETING response', () => {
        const message = 'hello';

        // Simulate the chat flow
        const category = analyzer.detectCategory(message);
        expect(category).toBe('GREETING');

        const promptBoost = analyzer.detectPromptBoost(message);
        expect(promptBoost).toBe(10);

        // Pick a response at a neutral emotion level
        const response = generator.selectResponse(category, 'GOOD', 50);
        expect(typeof response).toBe('string');
        expect(response.length).toBeGreaterThan(0);
    });
});
