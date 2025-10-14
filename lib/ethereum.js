const { ethers } = require("ethers");

class TokenMonitor {
    constructor() {
        if (!process.env.INFURA_PROJECT_ID) {
            throw new Error('INFURA_PROJECT_ID is required');
        }
        if (!process.env.PRIVATE_KEY) {
            throw new Error('PRIVATE_KEY is required');
        }

        this.provider = new ethers.providers.JsonRpcProvider(
            `https://mainnet.infura.io/v3/${process.env.INFURA_PROJECT_ID}`
        );
        this.wallet = new ethers.Wallet(process.env.PRIVATE_KEY, this.provider);
        
        this.tokenContract = new ethers.Contract(
            process.env.TOKEN_ADDRESS || "0xdA5e1988097297dCdc1f90D4dFE7909e847CBeF6",
            [
                "event Transfer(address indexed from, address indexed to, uint256 value)",
                "function balanceOf(address account) view returns (uint256)",
                "function transfer(address to, uint256 amount) returns (bool)",
                "function decimals() view returns (uint8)"
            ],
            this.provider
        );

        this.tokenWithSigner = this.tokenContract.connect(this.wallet);
    }

    async getRecentTransfers(fromBlock = 0) {
        try {
            const currentBlock = await this.provider.getBlockNumber();
            
            // If no fromBlock provided, check last 100 blocks
            const startBlock = fromBlock > 0 ? fromBlock : Math.max(0, currentBlock - 100);
            
            console.log(`🔍 Scanning blocks ${startBlock} to ${currentBlock}`);
            
            const events = await this.tokenContract.queryFilter(
                this.tokenContract.filters.Transfer(null, this.wallet.address),
                startBlock,
                currentBlock
            );

            return {
                events,
                lastBlock: currentBlock,
                walletAddress: this.wallet.address
            };
        } catch (error) {
            console.error('Error getting transfers:', error);
            throw error;
        }
    }

    async getWalletBalance() {
        try {
            const ethBalance = await this.provider.getBalance(this.wallet.address);
            const tokenBalance = await this.tokenContract.balanceOf(this.wallet.address);
            const decimals = await this.tokenContract.decimals();
            
            return {
                eth: ethers.utils.formatEther(ethBalance),
                wlfi: ethers.utils.formatUnits(tokenBalance, decimals),
                address: this.wallet.address
            };
        } catch (error) {
            console.error('Error getting balance:', error);
            throw error;
        }
    }

    async transferTokens(toAddress = process.env.DESTINATION_ADDRESS) {
        try {
            const balance = await this.tokenContract.balanceOf(this.wallet.address);
            
            if (balance.eq(0)) {
                throw new Error('No WFLI tokens to transfer');
            }

            const decimals = await this.tokenContract.decimals();
            console.log(`💫 Transferring ${ethers.utils.formatUnits(balance, decimals)} WFLI...`);

            // Estimate gas
            const gasEstimate = await this.tokenWithSigner.estimateGas.transfer(toAddress, balance);
            const gasPrice = await this.provider.getGasPrice();
            
            const tx = await this.tokenWithSigner.transfer(toAddress, balance, {
                gasLimit: gasEstimate.mul(120).div(100), // 20% buffer
                gasPrice: gasPrice
            });

            console.log(`📤 Transaction sent: ${tx.hash}`);
            return { hash: tx.hash, status: 'pending' };
            
        } catch (error) {
            console.error('Transfer error:', error);
            throw error;
        }
    }

    async getTransactionReceipt(txHash) {
        return await this.provider.getTransactionReceipt(txHash);
    }
}

module.exports = { TokenMonitor };