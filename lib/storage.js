const { kv } = require('@vercel/kv');

class Storage {
    constructor() {
        this.kv = kv;
    }

    async getLastCheckedBlock() {
        try {
            const block = await this.kv.get('lastCheckedBlock');
            return block ? parseInt(block) : 0;
        } catch (error) {
            console.error('Error getting last block:', error);
            return 0;
        }
    }

    async setLastCheckedBlock(blockNumber) {
        try {
            await this.kv.set('lastCheckedBlock', blockNumber.toString());
            return true;
        } catch (error) {
            console.error('Error setting last block:', error);
            return false;
        }
    }

    async isTransactionProcessed(txHash) {
        try {
            const processed = await this.kv.get(`processed:${txHash}`);
            return !!processed;
        } catch (error) {
            console.error('Error checking transaction:', error);
            return false;
        }
    }

    async markTransactionProcessed(txHash) {
        try {
            // Store for 7 days to prevent re-processing
            await this.kv.set(`processed:${txHash}`, 'true', { ex: 604800 });
            return true;
        } catch (error) {
            console.error('Error marking transaction:', error);
            return false;
        }
    }

    async getStats() {
        try {
            const stats = await this.kv.get('monitorStats') || {
                totalChecks: 0,
                transfersFound: 0,
                transfersProcessed: 0,
                lastCheck: null
            };
            return stats;
        } catch (error) {
            console.error('Error getting stats:', error);
            return {
                totalChecks: 0,
                transfersFound: 0,
                transfersProcessed: 0,
                lastCheck: null
            };
        }
    }

    async updateStats(newStats) {
        try {
            const stats = await this.getStats();
            const updated = { ...stats, ...newStats, lastCheck: new Date().toISOString() };
            await this.kv.set('monitorStats', updated);
            return updated;
        } catch (error) {
            console.error('Error updating stats:', error);
            return null;
        }
    }
}

module.exports = { Storage };