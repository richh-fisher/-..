const { TokenMonitor } = require('../lib/ethereum');
const { Storage } = require('../lib/storage');

module.exports = async (req, res) => {
    res.setHeader('Content-Type', 'text/html');
    
    try {
        const monitor = new TokenMonitor();
        const storage = new Storage();
        
        const balance = await monitor.getWalletBalance();
        const stats = await storage.getStats();
        const lastBlock = await storage.getLastCheckedBlock();

        const html = `
<!DOCTYPE html>
<html>
<head>
    <title>WFLI Token Monitor</title>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <style>
        body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
        .card { background: #f5f5f5; padding: 20px; margin: 10px 0; border-radius: 8px; }
        .success { background: #d4edda; color: #155724; }
        .warning { background: #fff3cd; color: #856404; }
        .error { background: #f8d7da; color: #721c24; }
        .btn { background: #0070f3; color: white; padding: 10px 20px; border: none; border-radius: 4px; cursor: pointer; }
        .btn:hover { background: #0056b3; }
    </style>
</head>
<body>
    <h1>🚨 WFLI Token Monitor</h1>
    
    <div class="card">
        <h2>Wallet Info</h2>
        <p><strong>Address:</strong> ${balance.address}</p>
        <p><strong>ETH Balance:</strong> ${balance.eth}</p>
        <p><strong>WFLI Balance:</strong> ${balance.wlfi}</p>
        <p><strong>Destination:</strong> ${process.env.DESTINATION_ADDRESS}</p>
    </div>

    <div class="card">
        <h2>Monitor Statistics</h2>
        <p><strong>Total Checks:</strong> ${stats.totalChecks}</p>
        <p><strong>Transfers Found:</strong> ${stats.transfersFound}</p>
        <p><strong>Transfers Processed:</strong> ${stats.transfersProcessed}</p>
        <p><strong>Last Check:</strong> ${stats.lastCheck || 'Never'}</p>
        <p><strong>Last Block Checked:</strong> ${lastBlock}</p>
    </div>

    <div class="card">
        <h2>Actions</h2>
        <button class="btn" onclick="manualCheck()">Manual Check</button>
        <button class="btn" onclick="manualTransfer()" ${balance.wlfi == 0 ? 'disabled' : ''}>
            Manual Transfer (${balance.wlfi} WFLI)
        </button>
    </div>

    <script>
        async function manualCheck() {
            const response = await fetch('/api/manual/trigger');
            const data = await response.json();
            alert(JSON.stringify(data, null, 2));
            location.reload();
        }

        async function manualTransfer() {
            if(confirm('Transfer ${balance.wlfi} WFLI to ${process.env.DESTINATION_ADDRESS}?')) {
                const response = await fetch('/api/manual/trigger?action=transfer');
                const data = await response.json();
                alert(JSON.stringify(data, null, 2));
                location.reload();
            }
        }
    </script>
</body>
</html>
        `;

        res.status(200).send(html);

    } catch (error) {
        const errorHtml = `
<!DOCTYPE html>
<html>
<body>
    <h1>Error</h1>
    <div class="card error">
        <p>${error.message}</p>
    </div>
</body>
</html>
        `;
        res.status(500).send(errorHtml);
    }
};