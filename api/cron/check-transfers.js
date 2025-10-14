const { Token } = require('../../lib/ethereum');
const { Storage } = require('../../lib/storage');

module.exports = async (req, res) => {
    // Set headers for longer execution time
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Connection', 'keep-alive');

    try {
        // Simple authentication for cron endpoint
        if (req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
            console.warn('Unauthorized cron attempt');
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const monitor = new TokenMonitor();
        const storage = new Storage();

        // Get last checked block
        const lastBlock = await storage.getLastCheckedBlock();
        console.log(`🕒 Last checked block: ${lastBlock}`);

        // Check for new transfers
        const { events, lastBlock: currentBlock } = await monitor.getRecentTransfers(lastBlock);
        
        let transfersProcessed = 0;
        const results = [];

        for (const event of events) {
            const txHash = event.transactionHash;
            
            // Skip if already processed
            if (await storage.isTransactionProcessed(txHash)) {
                console.log(`⏭️  Skipping already processed TX: ${txHash}`);
                continue;
            }

            console.log(`🎯 New WFLI transfer detected: ${txHash}`);
            
            try {
                // Process the transfer
                const result = await monitor.transferTokens();
                results.push({
                    txHash: event.transactionHash,
                    transferTx: result.hash,
                    status: 'processed'
                });
                
                await storage.markTransactionProcessed(txHash);
                transfersProcessed++;
                
            } catch (error) {
                console.error(`❌ Failed to process transfer ${txHash}:`, error.message);
                results.push({
                    txHash: event.transactionHash,
                    error: error.message,
                    status: 'failed'
                });
            }
        }

        // Update last checked block
        await storage.setLastCheckedBlock(currentBlock);

        // Update statistics
        const stats = await storage.updateStats({
            totalChecks: (await storage.getStats()).totalChecks + 1,
            transfersFound: (await storage.getStats()).transfersFound + events.length,
            transfersProcessed: (await storage.getStats()).transfersProcessed + transfersProcessed
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