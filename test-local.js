require('dotenv').config();
const { TokenMonitor } = require('./lib/ethereum');

async function testLocal() {
    console.log('🧪 Testing locally...\n');
    
    try {
        // Test 1: Environment variables
        console.log('1. Checking environment variables...');
        const requiredVars = ['PRIVATE_KEY', 'DESTINATION_ADDRESS', 'INFURA_PROJECT_ID'];
        for (const varName of requiredVars) {
            if (!process.env[varName]) {
                throw new Error(`Missing ${varName}`);
            }
            console.log(`   ✅ ${varName}: ${varName === 'PRIVATE_KEY' ? '***' + process.env[varName].slice(-6) : process.env[varName]}`);
        }

        // Test 2: Initialize TokenMonitor
        console.log('\n2. Initializing TokenMonitor...');
        const monitor = new TokenMonitor();
        console.log('   ✅ TokenMonitor initialized successfully');

        // Test 3: Check wallet balance
        console.log('\n3. Checking wallet balance...');
        const balance = await monitor.getWalletBalance();
        console.log(`   ✅ Address: ${balance.address}`);
        console.log(`   ✅ ETH Balance: ${balance.eth}`);
        console.log(`   ✅ WFLI Balance: ${balance.wlfi}`);

        // Test 4: Check recent transfers (last 10 blocks)
        console.log('\n4. Checking recent transfers...');
        const currentBlock = await monitor.provider.getBlockNumber();
        const { events } = await monitor.getRecentTransfers(currentBlock - 10);
        console.log(`   ✅ Found ${events.length} transfers in last 10 blocks`);

        // Test 5: Check token contract
        console.log('\n5. Testing token contract...');
        const decimals = await monitor.tokenContract.decimals();
        const symbol = await monitor.tokenContract.symbol?.().catch(() => 'Unknown');
        console.log(`   ✅ Token decimals: ${decimals}`);
        console.log(`   ✅ Token symbol: ${symbol}`);

        console.log('\n🎉 ALL TESTS PASSED! Ready for GitHub Actions.');

    } catch (error) {
        console.error('\n❌ TEST FAILED:', error.message);
        console.error('Stack:', error.stack);
        process.exit(1);
    }
}

testLocal();