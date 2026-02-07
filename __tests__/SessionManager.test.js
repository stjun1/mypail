const SessionManager = require('../SessionManager');
const fs = require('fs');
const path = require('path');
const os = require('os');

describe('SessionManager', () => {
    let sm;
    let testDir;

    beforeEach(() => {
        testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mypail-test-'));
        sm = new SessionManager(testDir);
    });

    afterEach(() => {
        sm.stopCleanup();
        fs.rmSync(testDir, { recursive: true, force: true });
    });

    describe('savePersistent / loadPersistent', () => {
        test('saves and loads session data', () => {
            const traits = { favoriteFood: 'pizza', fear: 'spiders' };
            sm.savePersistent('session-1', 'Mimi', traits);

            const loaded = sm.loadPersistent('session-1');
            expect(loaded).not.toBeNull();
            expect(loaded.aiName).toBe('Mimi');
            expect(loaded.traits.favoriteFood).toBe('pizza');
        });

        test('returns null for nonexistent session', () => {
            const loaded = sm.loadPersistent('nonexistent');
            expect(loaded).toBeNull();
        });

        test('sanitizes session ID to prevent directory traversal', () => {
            sm.savePersistent('../../../etc/passwd', 'Hacker', {});
            // Should create a file with sanitized name, not traverse directories
            const filePath = sm.getFilePath('../../../etc/passwd');
            expect(filePath).toContain(testDir);
            expect(filePath).not.toContain('..');
        });
    });

    describe('updateAccess', () => {
        test('updates lastAccess timestamp', () => {
            sm.savePersistent('session-1', 'Mimi', {});

            const before = sm.loadPersistent('session-1').lastAccess;

            // Small delay to ensure different timestamp
            const wait = Date.now() + 10;
            while (Date.now() < wait) {} // spin

            sm.updateAccess('session-1');

            const filePath = sm.getFilePath('session-1');
            const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
            expect(data.lastAccess).toBeGreaterThanOrEqual(before);
        });
    });

    describe('deletePersistent', () => {
        test('deletes a session file', () => {
            sm.savePersistent('session-1', 'Mimi', {});
            expect(sm.deletePersistent('session-1')).toBe(true);
            expect(sm.loadPersistent('session-1')).toBeNull();
        });

        test('returns false for nonexistent session', () => {
            expect(sm.deletePersistent('nonexistent')).toBe(false);
        });
    });

    describe('cleanupOldSessions', () => {
        test('removes expired sessions', () => {
            // Create a session with old timestamp
            const filePath = sm.getFilePath('old-session');
            const data = {
                sessionId: 'old-session',
                aiName: 'Old',
                traits: {},
                created: Date.now() - 48 * 60 * 60 * 1000,
                lastAccess: Date.now() - 48 * 60 * 60 * 1000
            };
            fs.writeFileSync(filePath, JSON.stringify(data));

            // Create a recent session
            sm.savePersistent('new-session', 'New', {});

            const result = sm.cleanupOldSessions();
            expect(result.deleted).toBe(1);
            expect(result.kept).toBe(1);
        });
    });

    describe('getStats', () => {
        test('returns correct session counts', () => {
            sm.savePersistent('s1', 'A', {});
            sm.savePersistent('s2', 'B', {});

            const stats = sm.getStats();
            expect(stats.total).toBe(2);
            expect(stats.active).toBe(2);
            expect(stats.recent).toBe(2);
        });

        test('returns zeros when no sessions exist', () => {
            const stats = sm.getStats();
            expect(stats.total).toBe(0);
        });
    });
});
