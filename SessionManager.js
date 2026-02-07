const fs = require('fs');
const path = require('path');

class SessionManager {
    constructor(sessionsDir) {
        this.sessionsDir = sessionsDir || path.join(__dirname, 'sessions');
        this.cleanupInterval = null;

        if (!fs.existsSync(this.sessionsDir)) {
            fs.mkdirSync(this.sessionsDir, { recursive: true });
        }
    }

    startCleanup() {
        this.cleanupInterval = setInterval(() => {
            this.cleanupOldSessions();
        }, 60 * 60 * 1000);

        setTimeout(() => this.cleanupOldSessions(), 5000);
    }

    stopCleanup() {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
            this.cleanupInterval = null;
        }
    }

    getFilePath(sessionId) {
        const safe = sessionId.replace(/[^a-zA-Z0-9-_]/g, '');
        return path.join(this.sessionsDir, `${safe}.json`);
    }

    loadPersistent(sessionId) {
        const filePath = this.getFilePath(sessionId);

        try {
            if (fs.existsSync(filePath)) {
                const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));

                const age = Date.now() - data.lastAccess;
                const maxAge = 24 * 60 * 60 * 1000;

                if (age > maxAge) {
                    this.deletePersistent(sessionId);
                    return null;
                }

                return {
                    aiName: data.aiName,
                    traits: data.traits,
                    schoolingLevels: data.schoolingLevels || { VERY_BAD: 4, BAD: 4, GOOD: 4, VERY_GOOD: 4 },
                    thresholds: data.thresholds || { VERY_BAD: -25, BAD: 25, GOOD: 50 },
                    created: data.created,
                    lastAccess: data.lastAccess
                };
            }
        } catch (error) {
            console.error(`Error loading session ${sessionId}:`, error.message);
        }

        return null;
    }

    savePersistent(sessionId, aiName, traits, schoolingLevels) {
        const filePath = this.getFilePath(sessionId);

        try {
            const data = {
                sessionId,
                aiName,
                traits,
                schoolingLevels: schoolingLevels || { VERY_BAD: 4, BAD: 4, GOOD: 4, VERY_GOOD: 4 },
                created: Date.now(),
                lastAccess: Date.now()
            };

            fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
            return true;
        } catch (error) {
            console.error(`Error saving session ${sessionId}:`, error.message);
            return false;
        }
    }

    updateAccess(sessionId) {
        const filePath = this.getFilePath(sessionId);

        try {
            if (fs.existsSync(filePath)) {
                const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
                data.lastAccess = Date.now();
                fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
            }
        } catch (error) {
            console.error(`Error updating access for ${sessionId}:`, error.message);
        }
    }

    updateThresholds(sessionId, thresholds) {
        const filePath = this.getFilePath(sessionId);

        try {
            if (fs.existsSync(filePath)) {
                const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
                data.thresholds = thresholds;
                data.lastAccess = Date.now();
                fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
                return true;
            }
        } catch (error) {
            console.error(`Error updating thresholds for ${sessionId}:`, error.message);
        }
        return false;
    }

    deletePersistent(sessionId) {
        const filePath = this.getFilePath(sessionId);

        try {
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
                return true;
            }
        } catch (error) {
            console.error(`Error deleting session ${sessionId}:`, error.message);
        }

        return false;
    }

    cleanupOldSessions() {
        try {
            const files = fs.readdirSync(this.sessionsDir);
            const maxAge = 24 * 60 * 60 * 1000;
            const now = Date.now();

            let deleted = 0;
            let kept = 0;

            for (const file of files) {
                if (!file.endsWith('.json')) continue;

                const filePath = path.join(this.sessionsDir, file);

                try {
                    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
                    const age = now - data.lastAccess;

                    if (age > maxAge) {
                        fs.unlinkSync(filePath);
                        deleted++;
                    } else {
                        kept++;
                    }
                } catch (error) {
                    // skip corrupted files
                }
            }

            return { deleted, kept };
        } catch (error) {
            return { deleted: 0, kept: 0 };
        }
    }

    getStats() {
        try {
            const files = fs.readdirSync(this.sessionsDir);
            const sessions = files.filter(f => f.endsWith('.json'));

            const now = Date.now();
            let active = 0;
            let recent = 0;

            for (const file of sessions) {
                const filePath = path.join(this.sessionsDir, file);
                try {
                    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
                    const age = now - data.lastAccess;

                    if (age < 60 * 60 * 1000) active++;
                    if (age < 24 * 60 * 60 * 1000) recent++;
                } catch (error) {
                    // skip corrupted files
                }
            }

            return { total: sessions.length, active, recent };
        } catch (error) {
            return { total: 0, active: 0, recent: 0 };
        }
    }
}

module.exports = SessionManager;
