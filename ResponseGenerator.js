const fs = require('fs');
const path = require('path');

class ResponseGenerator {
    constructor(responsesPath) {
        const filePath = responsesPath || path.join(__dirname, 'responses_complete.json');
        this.responses = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    }

    selectResponse(category, emotionState, emotionLevel) {
        const responseArray = this.responses[category]?.[emotionState];

        if (!responseArray || responseArray.length === 0) {
            return null;
        }

        const index = Math.floor((emotionLevel / 100) * responseArray.length);
        const clampedIndex = Math.max(0, Math.min(responseArray.length - 1, index));

        return responseArray[clampedIndex];
    }

    getAll(category, emotionState) {
        return this.responses[category]?.[emotionState] || [];
    }

    getTotalResponseCount() {
        let total = 0;
        for (const category in this.responses) {
            for (const state in this.responses[category]) {
                total += this.responses[category][state].length;
            }
        }
        return total;
    }
}

module.exports = ResponseGenerator;
