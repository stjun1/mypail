const ResponseGenerator = require('../ResponseGenerator');

describe('ResponseGenerator', () => {
    let generator;

    beforeEach(() => {
        generator = new ResponseGenerator();
    });

    test('works for all 7 categories', () => {
        const categories = ['PRAISE', 'INSULT', 'USER_POSITIVE', 'USER_NEGATIVE', 'CONFUSION', 'PHONE_STATUS', 'GREETING'];
        const states = ['VERY_BAD', 'BAD', 'GOOD', 'VERY_GOOD'];

        for (const category of categories) {
            for (const state of states) {
                const response = generator.selectResponse(category, state, 50);
                expect(response).toBeTruthy();
            }
        }
    });

    test('GREETING responses exist for all emotion states', () => {
        const states = ['VERY_BAD', 'BAD', 'GOOD', 'VERY_GOOD'];
        for (const state of states) {
            const responses = generator.getAll('GREETING', state);
            expect(responses.length).toBeGreaterThanOrEqual(25);
        }
    });

    test('selectResponse returns a string for GREETING', () => {
        const response = generator.selectResponse('GREETING', 'GOOD', 60);
        expect(typeof response).toBe('string');
        expect(response.length).toBeGreaterThan(0);
    });

    test('getTotalResponseCount includes GREETING responses', () => {
        const total = generator.getTotalResponseCount();
        // 7 categories × 4 states × ~25 responses = ~700
        expect(total).toBeGreaterThanOrEqual(700);
    });
});
