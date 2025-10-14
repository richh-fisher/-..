const { TokenMonitor } = require('../../lib/ethereum');
const { Storage } = require('../../lib/storage');

module.exports = async (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Connection', 'keep-alive');

    try {
        // Simple cron secret check (optional but recommended)
        if (process.env.CRON_SECRET && req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const monitor = new TokenMonitor();
        const storage = new Storage();

        // Get current block number first
        const currentBlock = await monitor.provider.getBlockNumber();
        
        // Get last checked block from storage
        let lastBlock = await storage.getLastCheckedBlock();
        
        // If no last block or it's too old, start from recent blocks
        if (lastBlock === 0 || currentBlock - lastBlock > 1000) {
            lastBlock = currentBlock - 100; // Check last 100 blocks
            console.log(`🆕 Starting from recent blocks: ${lastBlock} to ${currentBlock}`);
        }

        console.log(`🔍 Scanning blocks ${lastBlock} to ${currentBlock}`);

        // Check for new transfers
        const { events } = await monitor.getRecentTransfers(lastBlock);
        
        let transfersProcessed = 0;
        const results = [];

        for (const event of events) {
            const txHash = event.transactionHash;
            
            // Skip if already processed (in this session)
            if (await storage.isTransactionProcessed(txHash)) {
                console.log(`⏭️ Skipping already processed TX: ${txHash}`);
                continue;
            }

            console.log(`🎯 New WFLI transfer detected: ${txHash}`);
            
            try {
                // Wait a bit for block confirmation
                await new Promise(resolve => setTimeout(resolve, 5000));
                
                // Process the transfer
                const result = await monitor.transferTokens();
                results.push({
                    txHash: txHash,
                    transferTx: result.hash,
                    status: 'processed'
                });
                
                await storage.markTransactionProcessed(txHash);
                transfersProcessed++;
                
                console.log(`✅ Transfer initiated: ${result.hash}`);
                
            } catch (error) {
                console.error(`❌ Failed to process transfer ${txHash}:`, error.message);
                results.push({
                    txHash: txHash,
                    error: error.message,
                    status: 'failed'
                });
            }
        }

        // Update last checked block to current block
        await storage.setLastCheckedBlock(currentBlock);

        // Update statistics
        const stats = await storage.updateStats({
            totalChecks: (await storage.getStats()).totalChecks + 1,
            transfersFound: events.length,
            transfersProcessed: transfersProcessed
        });

        const response = {
            success: true,
            results: {
                blocksScanned: { from: lastBlock, to: currentBlock },
                transfersFound: events.length,
                transfersProcessed: transfersProcessed,
                details: results
            },
            statistics: stats,
            storageInfo: storage.getStorageInfo(),
            timestamp: new Date().toISOString()
        };

        console.log(`✅ Cron job completed: ${transfersProcessed}/${events.length} transfers processed`);
        res.status(200).json(response);

    } catch (error) {
        console.error('❌ Cron job failed:', error);
        res.status(500).json({
            success: false,
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
};