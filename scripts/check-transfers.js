const { TokenMonitor } = require('../lib/ethereum');
const { Storage } = require('../lib/storage');

async function main() {
    console.log('🚀 Starting WFLI Token Monitor...');
    console.log('⏰', new Date().toISOString());
    
    try {
        const monitor = new TokenMonitor();
        const storage = new Storage();

        // Get current block number
        const currentBlock = await monitor.provider.getBlockNumber();
        
        // Get last checked block from storage
        let lastBlock = await storage.getLastCheckedBlock();
        
        // If no last block or it's too old, start from recent blocks
        if (lastBlock === 0 || currentBlock - lastBlock > 1000) {
            lastBlock = currentBlock - 100;
            console.log(`🆕 Starting from recent blocks: ${lastBlock}`);
        }

        console.log(`🔍 Scanning blocks ${lastBlock} to ${currentBlock}`);

        // Check for new transfers
        const { events } = await monitor.getRecentTransfers(lastBlock);
        
        let transfersProcessed = 0;
        const results = [];

        console.log(`📊 Found ${events.length} transfer events`);

        for (const event of events) {
            const txHash = event.transactionHash;
            
            // Skip if already processed
            if (await storage.isTransactionProcessed(txHash)) {
                console.log(`⏭️ Skipping already processed TX: ${txHash}`);
                continue;
            }

            console.log(`🎯 New WFLI transfer detected: ${txHash}`);
            console.log(`   From: ${event.args.from}`);
            console.log(`   Amount: ${event.args.value.toString()}`);
            
            try {
                // Wait a bit for block confirmation
                console.log('⏳ Waiting for confirmation...');
                await new Promise(resolve => setTimeout(resolve, 10000));
                
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
                
                // If it's an insufficient funds error, we should stop
                if (error.message.includes('insufficient funds')) {
                    console.error('🚨 Insufficient ETH for gas fees!');
                }
            }
        }

        // Update last checked block
        await storage.setLastCheckedBlock(currentBlock);

        // Update statistics
        const stats = await storage.updateStats({
            totalChecks: (await storage.getStats()).totalChecks + 1,
            transfersFound: events.length,
            transfersProcessed: transfersProcessed
        });

        // Get wallet balance for reporting
        const balance = await monitor.getWalletBalance();

        console.log('📈 ========== MONITORING REPORT ==========');
        console.log(`✅ Checks completed: ${stats.totalChecks}`);
        console.log(`🎯 Transfers found: ${events.length}`);
        console.log(`🚀 Transfers processed: ${transfersProcessed}`);
        console.log(`💰 ETH Balance: ${balance.eth}`);
        console.log(`🪙 WFLI Balance: ${balance.wlfi}`);
        console.log(`📦 Last block checked: ${currentBlock}`);
        console.log('⏰', new Date().toISOString());
        console.log('==========================================');

        // Exit successfully
        process.exit(0);

    } catch (error) {
        console.error('❌ MONITOR FAILED:', error);
        process.exit(1);
    }
}

// Handle uncaught errors
process.on('uncaughtException', (error) => {
    console.error('💥 Uncaught Exception:', error);
    process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('💥 Unhandled Rejection at:', promise, 'reason:', reason);
    process.exit(1);
});

// Run the monitor
main();