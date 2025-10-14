const { TokenMonitor } = require('../../lib/ethereum');
const { Storage } = require('../../lib/storage');

module.exports = async (req, res) => {
    res.setHeader('Content-Type', 'application/json');

    try {
        const monitor = new TokenMonitor();
        const storage = new Storage();

        // Get current balance
        const balance = await monitor.getWalletBalance();
        
        // Manual transfer trigger
        if (req.query.action === 'transfer' && balance.wlfi > 0) {
            try {
                const result = await monitor.transferTokens();
                return res.status(200).json({
                    success: true,
                    message: 'Manual transfer initiated',
                    transaction: result,
                    balance: balance
                });
            } catch (error) {
                return res.status(400).json({
                    success: false,
                    error: error.message,
                    balance: balance
                });
            }
        }

        // Status check
        const stats = await storage.getStats();
        const lastBlock = await storage.getLastCheckedBlock();

        res.status(200).json({
            success: true,
            balance: balance,
            statistics: stats,
            lastCheckedBlock: lastBlock,
            monitorAddress: balance.address,
            destinationAddress: process.env.DESTINATION_ADDRESS
        });

    } catch (error) {
        console.error('Manual trigger error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};