const { ethers } = require("ethers");
require('dotenv').config();

// ====== CONFIGURATION ======
const CHAIN = {
    name: "Ethereum",
    websocket: process.env.INFURA_URL || "wss://mainnet.infura.io/ws/v3/0ed9fbc047c7418a917d9421adaa58c6",
    chainId: 1,
    privateKeyOrMnemonic: process.env.PRIVATE_KEY,
    to: process.env.DESTINATION_ADDRESS,
};

// WFLI Token Configuration
const WLFI_TOKEN = {
    address: "0xdA5e1988097297dCdc1f90D4dFE7909e847CBeF6",
    abi: [
        "event Transfer(address indexed from, address indexed to, uint256 value)",
        "function balanceOf(address account) external view returns (uint256)",
        "function transfer(address to, uint256 amount) external returns (bool)",
        "function decimals() external view returns (uint8)"
    ]
};

// Wallet creation helper
function getWallet(input, provider) {
    try {
        if (!input) {
            throw new Error("No private key or mnemonic provided");
        }

        if (/^(0x)?[0-9a-fA-F]{64}$/.test(input.trim())) {
            const pk = input.trim().startsWith("0x") ? input.trim() : `0x${input.trim()}`;
            return new ethers.Wallet(pk, provider);
        }

        const [mnemonic, passphrase] = input.includes("|||") ? input.split("|||") : [input, undefined];

        if (!ethers.utils.isValidMnemonic(mnemonic.trim())) {
            throw new Error("Invalid mnemonic");
        }

        const hdNode = ethers.utils.HDNode.fromMnemonic(mnemonic.trim(), passphrase?.trim());
        return new ethers.Wallet(hdNode.derivePath("m/44'/60'/0'/0/0"), provider);

    } catch (err) {
        console.error("❌ Wallet creation failed:", err.message);
        process.exit(1);
    }
}

async function monitorWLFITokens(chain) {
    const { name, websocket, chainId, privateKeyOrMnemonic, to } = chain;
    
    if (!privateKeyOrMnemonic) {
        console.error("❌ No private key or mnemonic provided");
        return;
    }

    console.log(`🚀 Starting WFLI token monitor on ${name}...`);
    
    const provider = new ethers.providers.WebSocketProvider(websocket, { name, chainId });
    const wallet = getWallet(privateKeyOrMnemonic, provider);
    
    // Create token contract instance
    const tokenContract = new ethers.Contract(WLFI_TOKEN.address, WLFI_TOKEN.abi, provider);
    const tokenWithSigner = tokenContract.connect(wallet);
    
    let decimals = 18;
    try {
        decimals = await tokenContract.decimals();
        console.log(`ℹ️  WFLI token decimals: ${decimals}`);
    } catch (err) {
        console.log("⚠️  Could not fetch decimals, using default 18");
    }

    console.log(`🚨 Monitoring ${name} for WFLI tokens to ${wallet.address}...`);
    console.log(`📤 Will auto-transfer to: ${to}`);

    // Listen for Transfer events to our wallet
    tokenContract.on("Transfer", async (from, toAddress, value, event) => {
        try {
            // Check if the transfer is TO our wallet
            if (toAddress.toLowerCase() === wallet.address.toLowerCase()) {
                const amount = ethers.utils.formatUnits(value, decimals);
                console.log(`🎯 Received ${amount} WFLI from ${from}`);

                // Wait a few seconds to ensure balance is updated
                await new Promise(resolve => setTimeout(resolve, 5000));

                // Get current WFLI balance
                const balance = await tokenContract.balanceOf(wallet.address);
                
                if (balance.eq(0)) {
                    console.log("❗ No WFLI balance to transfer");
                    return;
                }

                console.log(`💫 Sending ${ethers.utils.formatUnits(balance, decimals)} WFLI to destination...`);

                try {
                    // Estimate gas for token transfer
                    const gasEstimate = await tokenWithSigner.estimateGas.transfer(to, balance);
                    const gasPrice = await provider.getGasPrice();
                    
                    // Add 20% buffer to gas estimate
                    const gasLimit = gasEstimate.mul(120).div(100);

                    const tx = await tokenWithSigner.transfer(to, balance, {
                        gasLimit: gasLimit,
                        gasPrice: gasPrice
                    });

                    console.log(`⏳ WFLI TX submitted: ${tx.hash}`);

                    const receipt = await Promise.race([
                        tx.wait(1),
                        new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout")), 60000)),
                    ]);

                    if (receipt && receipt.status === 1) {
                        console.log(`✅ WFLI transfer confirmed in block ${receipt.blockNumber}`);
                    } else {
                        console.warn(`❌ WFLI TX not confirmed.`);
                    }
                } catch (txError) {
                    console.error(`❌ Transfer execution error:`, txError.message);
                    
                    if (txError.message.includes("insufficient funds")) {
                        console.log("💡 Need ETH for gas fees to transfer WFLI tokens");
                    }
                }
            }
        } catch (err) {
            console.error(`❌ WFLI transfer error:`, err.message);
        }
    });

    // Handle provider errors and reconnections
    provider._websocket.on("error", (error) => {
        console.error("WebSocket error:", error);
    });

    provider._websocket.on("close", (code, reason) => {
        console.log(`WebSocket closed. Code: ${code}, Reason: ${reason}`);
        console.log("Attempting to reconnect in 10 seconds...");
        setTimeout(() => {
            console.log("Reconnecting...");
            monitorWLFITokens(chain);
        }, 10000);
    });

    // Periodic health check
    setInterval(async () => {
        try {
            const block = await provider.getBlockNumber();
            const ethBalance = await provider.getBalance(wallet.address);
            const wlfiBalance = await tokenContract.balanceOf(wallet.address);
            
            console.log(`❤️  Health check - Block: ${block}, ETH: ${ethers.utils.formatEther(ethBalance)}, WFLI: ${ethers.utils.formatUnits(wlfiBalance, decimals)}`);
        } catch (error) {
            console.error("Health check failed:", error.message);
        }
    }, 2000); // Every minute
}

// Error handling for uncaught exceptions
process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// Start monitoring
if (require.main === module) {
    monitorWLFITokens(CHAIN).catch(console.error);
}

module.exports = { monitorWLFITokens };