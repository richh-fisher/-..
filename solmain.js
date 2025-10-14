const {
  Connection,
  PublicKey,
  Keypair,
  LAMPORTS_PER_SOL,
  SystemProgram,
  Transaction,
  sendAndConfirmTransaction,
  ComputeBudgetProgram,
} = require("@solana/web3.js");
const bip39 = require("bip39");
const ed25519 = require("ed25519-hd-key");

// ===== CONFIGURATION =====
const INPUT = "song cave solar uncle body example movie vicious private artefact glory junior"; // Mnemonic or 64-byte secret key
const TO_ADDRESS = "EcUcQQ9cSxVNeAHArtgRLbygoNVyfwneP1exHTdBjtAD";
const CONNECTION = new Connection("https://api.mainnet-beta.solana.com", "confirmed");

// Fee buffer configuration (in SOL)
const FEE_BUFFER_SOL = 0.002; // Increased buffer to account for dynamic fees
const FEE_BUFFER_LAMPORTS = Math.floor(FEE_BUFFER_SOL * LAMPORTS_PER_SOL);

// === Convert mnemonic or raw private key to Keypair ===
function getKeypair(input) {
  const isMnemonic = input.trim().split(" ").length >= 12;
  if (isMnemonic) {
    const seed = bip39.mnemonicToSeedSync(input.trim());
    const derived = ed25519.derivePath("m/44'/501'/0'/0'", seed.toString("hex"));
    return Keypair.fromSeed(derived.key);
  } else {
    try {
      const bytes = JSON.parse(input);
      if (Array.isArray(bytes) && bytes.length === 64) {
        return Keypair.fromSecretKey(Uint8Array.from(bytes));
      } else {
        throw new Error("Invalid private key format");
      }
    } catch (e) {
      throw new Error("Invalid private key JSON");
    }
  }
}

// === Estimate transaction fee ===
async function estimateTransactionFee(connection, transaction, payer) {
  try {
    // Get recent blockhash
    const { blockhash } = await connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = payer;
    
    // Calculate fee
    const fee = await transaction.getEstimatedFee(connection);
    return fee || 5000; // Default to 5000 lamports if estimation fails
  } catch (error) {
    console.error("Error estimating fee:", error.message);
    return 10000; // Fallback to a safe fee if estimation fails
  }
}

// === MAIN SCRIPT ===
(async () => {
  const keypair = getKeypair(INPUT);
  const publicKey = keypair.publicKey;
  const toPubkey = new PublicKey(TO_ADDRESS);

  console.log(`🚨 Monitoring wallet ${publicKey.toBase58()} for incoming SOL...`);
  console.log(`💵 Will maintain a buffer of ${FEE_BUFFER_SOL} SOL for fees`);

  CONNECTION.onAccountChange(publicKey, async (accountInfo) => {
    const lamports = accountInfo.lamports;
    const sol = lamports / LAMPORTS_PER_SOL;
    console.log(`💰 Balance updated: ${sol.toFixed(8)} SOL`);

    if (lamports > FEE_BUFFER_LAMPORTS) {
      // Create a test transaction to estimate fees
      const testTx = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: publicKey,
          toPubkey: toPubkey,
          lamports: 1000, // Minimal amount for estimation
        })
      );

      try {
        // Estimate the transaction fee
        const estimatedFee = await estimateTransactionFee(CONNECTION, testTx, publicKey);
        console.log(`📊 Estimated fee: ${estimatedFee / LAMPORTS_PER_SOL} SOL`);
        
        // Calculate amount to send (balance minus fee buffer minus estimated fee)
        const amountToSend = lamports - FEE_BUFFER_LAMPORTS - estimatedFee;
        
        if (amountToSend <= 0) {
          console.log(`⚠️ Insufficient balance after fee calculation`);
          return;
        }

        // Create the actual transaction
        const tx = new Transaction().add(
          SystemProgram.transfer({
            fromPubkey: publicKey,
            toPubkey: toPubkey,
            lamports: amountToSend,
          })
        );

        const sig = await sendAndConfirmTransaction(CONNECTION, tx, [keypair]);
        console.log(`✅ Sent ${(amountToSend / LAMPORTS_PER_SOL).toFixed(8)} SOL → ${toPubkey.toBase58()}`);
        console.log(`🔗 https://solscan.io/tx/${sig}`);
      } catch (err) {
        console.error("❌ Transaction failed:", err.message);
      }
    } else {
      console.log(`⚠️ Balance below fee buffer (${FEE_BUFFER_SOL.toFixed(8)} SOL needed)`);
    }
  });
})();