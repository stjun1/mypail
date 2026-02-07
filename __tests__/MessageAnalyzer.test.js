const MessageAnalyzer = require('../MessageAnalyzer');

describe('MessageAnalyzer', () => {
    let analyzer;

    beforeEach(() => {
        analyzer = new MessageAnalyzer();
    });

    describe('detectCategory', () => {
        test('detects GREETING for common greetings', () => {
            expect(analyzer.detectCategory('hello')).toBe('GREETING');
            expect(analyzer.detectCategory('hi')).toBe('GREETING');
            expect(analyzer.detectCategory('hey')).toBe('GREETING');
            expect(analyzer.detectCategory('howdy')).toBe('GREETING');
            expect(analyzer.detectCategory('greetings')).toBe('GREETING');
            expect(analyzer.detectCategory('yo')).toBe('GREETING');
            expect(analyzer.detectCategory('sup')).toBe('GREETING');
        });

        test('detects GREETING for phrases', () => {
            expect(analyzer.detectCategory('how are you')).toBe('GREETING');
            expect(analyzer.detectCategory("what's up")).toBe('GREETING');
            expect(analyzer.detectCategory('good morning')).toBe('GREETING');
            expect(analyzer.detectCategory('good evening')).toBe('GREETING');
            expect(analyzer.detectCategory('good night')).toBe('GREETING');
            expect(analyzer.detectCategory("what's going on")).toBe('GREETING');
        });

        test('detects GREETING case-insensitively', () => {
            expect(analyzer.detectCategory('Hello')).toBe('GREETING');
            expect(analyzer.detectCategory('HEY THERE')).toBe('GREETING');
            expect(analyzer.detectCategory('Good Morning!')).toBe('GREETING');
        });

        test('PHONE_STATUS takes priority over GREETING', () => {
            expect(analyzer.detectCategory('how are your systems')).toBe('PHONE_STATUS');
            expect(analyzer.detectCategory('battery status')).toBe('PHONE_STATUS');
        });

        test('GREETING takes priority over PRAISE', () => {
            // "hey" is a greeting keyword; should not fall through to other categories
            expect(analyzer.detectCategory('hey')).toBe('GREETING');
        });
    });

    describe('detectPromptBoost', () => {
        test('returns GREETING trigger value for greetings', () => {
            expect(analyzer.detectPromptBoost('hello')).toBe(10);
            expect(analyzer.detectPromptBoost('hi there')).toBe(10);
            expect(analyzer.detectPromptBoost('good morning')).toBe(10);
        });

        test('INSULT still takes priority over GREETING in boost detection', () => {
            expect(analyzer.detectPromptBoost('hello you idiot')).toBe(-20);
        });
    });

    describe('isGreeting', () => {
        test('returns true for greeting keywords', () => {
            expect(analyzer.isGreeting('hello')).toBe(true);
            expect(analyzer.isGreeting('hey there')).toBe(true);
            expect(analyzer.isGreeting('sup dude')).toBe(true);
        });

        test('returns false for non-greetings', () => {
            expect(analyzer.isGreeting('tell me a joke')).toBe(false);
            expect(analyzer.isGreeting('what is the weather')).toBe(false);
        });
    });
});
