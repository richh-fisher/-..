// Simple in-memory storage that works on Vercel
// Data persists during function execution but resets on cold starts
// This is fine for our use case since we're checking blocks sequentially

class Storage {
    constructor() {
        // These will reset on cold starts, but that's acceptable
        this.data = {
            lastCheckedBlock: 0,
            processedTransactions: new Set(),
            stats: {
                totalChecks: 0,
                transfersFound: 0,
                transfersProcessed: 0,
                lastCheck: null
            }
        };
        
        console.log('🔄 Using in-memory storage');
    }

    async getLastCheckedBlock() {
        // If we don't have a stored block, start from current block - 100
        if (this.data.lastCheckedBlock === 0) {
            // We'll set this properly in the main function
            return 0;
        }
        return this.data.lastCheckedBlock;
    }

    async setLastCheckedBlock(blockNumber) {
        this.data.lastCheckedBlock = blockNumber;
        console.log(`💾 Saved last checked block: ${blockNumber}`);
        return true;
    }

    async isTransactionProcessed(txHash) {
        return this.data.processedTransactions.has(txHash);
    }

    async markTransactionProcessed(txHash) {
        this.data.processedTransactions.add(txHash);
        // Keep only last 1000 transactions to prevent memory issues
        if (this.data.processedTransactions.size > 1000) {
            const first = this.data.processedTransactions.values().next().value;
            this.data.processedTransactions.delete(first);
        }
        return true;
    }

    async getStats() {
        return this.data.stats;
    }

    async updateStats(newStats) {
        this.data.stats = { 
            ...this.data.stats, 
            ...newStats, 
            lastCheck: new Date().toISOString() 
        };
        return this.data.stats;
    }

    // Helper to get storage info
    getStorageInfo() {
        return {
            lastBlock: this.data.lastCheckedBlock,
            processedTxCount: this.data.processedTransactions.size,
            stats: this.data.stats
        };
    }
}

module.exports = { Storage };