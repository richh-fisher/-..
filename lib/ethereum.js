require('dotenv').config();
const { ethers } = require("ethers");

class TokenMonitor {
    constructor() {
        if (!process.env.PRIVATE_KEY) {
            throw new Error('PRIVATE_KEY environment variable is required');
        }

        // Clean and validate private key
        let privateKey = process.env.PRIVATE_KEY.trim();
        
        // If it's a mnemonic (words), handle it differently
        if (privateKey.split(' ').length >= 12) {
            // It's a mnemonic phrase
            console.log('🔑 Using mnemonic phrase');
            try {
                const hdNode = ethers.utils.HDNode.fromMnemonic(privateKey);
                this.wallet = new ethers.Wallet(hdNode.derivePath("m/44'/60'/0'/0/0"));
            } catch (error) {
                throw new Error(`Invalid mnemonic: ${error.message}`);
            }
        } else {
            // It should be a private key
            console.log('🔑 Using private key');
            try {
                // Ensure it has 0x prefix
                if (!privateKey.startsWith('0x')) {
                    privateKey = '0x' + privateKey;
                }
                this.wallet = new ethers.Wallet(privateKey);
            } catch (error) {
                throw new Error(`Invalid private key: ${error.message}`);
            }
        }

        if (!process.env.INFURA_PROJECT_ID) {
            throw new Error('INFURA_PROJECT_ID is required');
        }

        this.provider = new ethers.providers.JsonRpcProvider(
            `https://mainnet.infura.io/v3/${process.env.INFURA_PROJECT_ID}`
        );
        
        // Connect wallet to provider
        this.wallet = this.wallet.connect(this.provider);
        
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
        
        console.log(`✅ Wallet initialized: ${this.wallet.address}`);
    }

    async getRecentTransfers(fromBlock = 0) {
        const currentBlock = await this.provider.getBlockNumber();
        const startBlock = fromBlock > 0 ? fromBlock : Math.max(0, currentBlock - 100);
        
        console.log(`🔍 Querying blocks ${startBlock} to ${currentBlock}`);
        
        const events = await this.tokenContract.queryFilter(
            this.tokenContract.filters.Transfer(null, this.wallet.address),
            startBlock,
            currentBlock
        );

        return { events, lastBlock: currentBlock };
    }

    async getWalletBalance() {
        const ethBalance = await this.provider.getBalance(this.wallet.address);
        const tokenBalance = await this.tokenContract.balanceOf(this.wallet.address);
        
        let decimals = 18;
        try {
            decimals = await this.tokenContract.decimals();
        } catch (error) {
            console.log('⚠️ Could not fetch decimals, using default 18');
        }
        
        return {
            eth: ethers.utils.formatEther(ethBalance),
            wlfi: ethers.utils.formatUnits(tokenBalance, decimals),
            address: this.wallet.address
        };
    }

    async transferTokens(toAddress = process.env.DESTINATION_ADDRESS) {
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
            gasLimit: gasEstimate.mul(120).div(100),
            gasPrice: gasPrice
        });

        return { hash: tx.hash, status: 'pending' };
    }
}

module.exports = { TokenMonitor };