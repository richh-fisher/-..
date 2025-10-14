const fs = require('fs');
const path = require('path');

// Store data in a file for persistence between GitHub Actions runs
const DATA_FILE = path.join(__dirname, '../data/storage.json');

class Storage {
    constructor() {
        this.ensureDataFile();
        this.data = this.loadData();
        console.log('💾 Using file-based storage');
    }

    ensureDataFile() {
        const dir = path.dirname(DATA_FILE);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        if (!fs.existsSync(DATA_FILE)) {
            fs.writeFileSync(DATA_FILE, JSON.stringify({
                lastCheckedBlock: 0,
                processedTransactions: [],
                stats: {
                    totalChecks: 0,
                    transfersFound: 0,
                    transfersProcessed: 0,
                    lastCheck: null
                }
            }, null, 2));
        }
    }

    loadData() {
        try {
            const rawData = fs.readFileSync(DATA_FILE, 'utf8');
            const data = JSON.parse(rawData);
            // Convert array back to Set for processedTransactions
            data.processedTransactions = new Set(data.processedTransactions || []);
            return data;
        } catch (error) {
            console.error('Error loading storage data:', error);
            return {
                lastCheckedBlock: 0,
                processedTransactions: new Set(),
                stats: {
                    totalChecks: 0,
                    transfersFound: 0,
                    transfersProcessed: 0,
                    lastCheck: null
                }
            };
        }
    }

    saveData() {
        try {
            const dataToSave = {
                ...this.data,
                processedTransactions: Array.from(this.data.processedTransactions)
            };
            fs.writeFileSync(DATA_FILE, JSON.stringify(dataToSave, null, 2));
        } catch (error) {
            console.error('Error saving storage data:', error);
        }
    }

    async getLastCheckedBlock() {
        return this.data.lastCheckedBlock;
    }

    async setLastCheckedBlock(blockNumber) {
        this.data.lastCheckedBlock = blockNumber;
        this.saveData();
        console.log(`💾 Saved last checked block: ${blockNumber}`);
        return true;
    }

    async isTransactionProcessed(txHash) {
        return this.data.processedTransactions.has(txHash);
    }

    async markTransactionProcessed(txHash) {
        this.data.processedTransactions.add(txHash);
        // Keep only last 500 transactions to prevent file from growing too large
        if (this.data.processedTransactions.size > 500) {
            const array = Array.from(this.data.processedTransactions);
            array.shift(); // Remove oldest
            this.data.processedTransactions = new Set(array);
        }
        this.saveData();
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
        this.saveData();
        return this.data.stats;
    }
}

module.exports = { Storage };