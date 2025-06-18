import dotenv from "dotenv";
dotenv.config();

import { ethers } from "ethers";
import { PKPWalletManager } from "./index";

// ================================
// SIMPLE EXAMPLES
// ================================

async function basicExample() {
  console.log("🚀 PKP Wallet - Basic Example\n");

  try {
    // Step 1: Initialize the PKP Manager
    console.log("1️⃣ Initializing PKP Manager...");
    const pkpManager = new PKPWalletManager(process.env.PRIVATE_KEY!);
    await pkpManager.initialize();
    console.log("✅ PKP Manager ready!\n");

    // Step 2: Create a wallet for a user
    console.log("2️⃣ Creating wallet for user...");
    const userData = {
      id: "demo_user_001",
      name: "Demo User",
      email: "demo@example.com",
    };

    const pkp = await pkpManager.createWallet(userData);
    console.log(`✅ Wallet created: ${pkp.ethAddress}\n`);

    // Step 3: Get wallet information
    console.log("3️⃣ Getting wallet info...");
    const walletInfo = await pkpManager.getWalletInfo(userData.id);
    console.log(`Address: ${walletInfo.address}`);
    console.log(`Balance: ${walletInfo.balance} ETH`);
    console.log(`Chain ID: ${walletInfo.chainId}`);
    console.log(`Nonce: ${walletInfo.nonce}\n`);

    // Step 4: Sign a simple message
    console.log("4️⃣ Signing a message...");
    const message = "Hello from PKP wallet! 👋";
    const signature = await pkpManager.signMessage(userData.id, message);
    console.log(`Message: "${message}"`);
    console.log(
      `Signature: ${signature.slice(0, 20)}...${signature.slice(-20)}\n`
    );

    // Step 5: Verify the signature
    console.log("5️⃣ Verifying signature...");
    const isValid = pkpManager.verifySignature(
      message,
      signature,
      walletInfo.address
    );
    console.log(`✅ Signature valid: ${isValid}\n`);

    console.log("🎉 Basic example completed successfully!");
  } catch (error) {
    console.error("❌ Error in basic example:", error.message);
  }
}

async function multiChainExample() {
  console.log("\n" + "=".repeat(50));
  console.log("🌐 PKP Wallet - Multi-Chain Example\n");

  try {
    const pkpManager = new PKPWalletManager(process.env.PRIVATE_KEY!);
    await pkpManager.initialize();

    const userData = {
      id: "multichain_user",
      name: "Multi-Chain User",
      email: "multichain@example.com",
    };

    // Create wallet once
    console.log("1️⃣ Creating multi-chain wallet...");
    const pkp = await pkpManager.createWallet(userData);
    console.log(`✅ Wallet address: ${pkp.ethAddress}\n`);

    // Show supported chains
    console.log("2️⃣ Supported chains:");
    const chains = pkpManager.getSupportedChains();
    chains.forEach((chain) => console.log(`   • ${chain}`));
    console.log();

    // Sign same message on different chains
    console.log("3️⃣ Signing message across chains...");
    const message = "Same wallet, different chains! 🌍";

    const testChains = ["datil", "ethereum", "polygon"];

    for (const chain of testChains) {
      try {
        console.log(`   Signing on ${chain}...`);
        const signature = await pkpManager.signMessage(userData.id, message, {
          chain,
        });
        console.log(`   ✅ ${chain}: ${signature.slice(0, 15)}...`);
      } catch (error) {
        console.log(`   ⚠️  ${chain}: ${error.message}`);
      }
    }

    console.log("\n🎉 Multi-chain example completed!");
  } catch (error) {
    console.error("❌ Error in multi-chain example:", error.message);
  }
}

async function eip712Example() {
  console.log("\n" + "=".repeat(50));
  console.log("📜 PKP Wallet - EIP-712 Signing Example\n");

  try {
    const pkpManager = new PKPWalletManager(process.env.PRIVATE_KEY!);
    await pkpManager.initialize();

    const userData = {
      id: "eip712_user",
      name: "EIP-712 User",
      email: "eip712@example.com",
    };

    console.log("1️⃣ Creating wallet...");
    const pkp = await pkpManager.createWallet(userData);
    console.log(`✅ Wallet: ${pkp.ethAddress}\n`);

    console.log("2️⃣ Setting up EIP-712 data...");

    // Define the domain
    const domain = {
      name: "PKP Demo DApp",
      version: "1.0.0",
      chainId: 175188, // Datil testnet
      verifyingContract: "0x1234567890123456789012345678901234567890",
    };

    // Define the types
    const types = {
      Person: [
        { name: "name", type: "string" },
        { name: "wallet", type: "address" },
      ],
      Mail: [
        { name: "from", type: "Person" },
        { name: "to", type: "Person" },
        { name: "contents", type: "string" },
        { name: "timestamp", type: "uint256" },
      ],
    };

    // Define the value
    const value = {
      from: {
        name: userData.name,
        wallet: pkp.ethAddress,
      },
      to: {
        name: "PKP Demo",
        wallet: "0x0000000000000000000000000000000000000000",
      },
      contents: "Hello from EIP-712 signed message!",
      timestamp: Math.floor(Date.now() / 1000),
    };

    console.log("3️⃣ Signing EIP-712 data...");
    const signature = await pkpManager.signTypedData(
      userData.id,
      domain,
      types,
      value
    );
    console.log(
      `✅ EIP-712 signature: ${signature.slice(0, 20)}...${signature.slice(
        -20
      )}\n`
    );

    console.log("4️⃣ Verifying EIP-712 signature...");
    const isValid = pkpManager.verifyTypedDataSignature(
      domain,
      types,
      value,
      signature,
      pkp.ethAddress
    );
    console.log(`✅ EIP-712 signature valid: ${isValid}\n`);

    console.log("🎉 EIP-712 example completed!");
  } catch (error) {
    console.error("❌ Error in EIP-712 example:", error.message);
  }
}

async function permitExample() {
  console.log("\n" + "=".repeat(50));
  console.log("🎫 PKP Wallet - ERC-2612 Permit Example\n");

  try {
    const pkpManager = new PKPWalletManager(process.env.PRIVATE_KEY!);
    await pkpManager.initialize();

    const userData = {
      id: "permit_user",
      name: "Permit User",
      email: "permit@example.com",
    };

    console.log("1️⃣ Creating wallet...");
    const pkp = await pkpManager.createWallet(userData);
    console.log(`✅ Wallet: ${pkp.ethAddress}\n`);

    console.log("2️⃣ Creating ERC-2612 permit (gasless approval)...");

    // Example permit data
    const permitData = {
      owner: pkp.ethAddress,
      spender: "0x1234567890123456789012345678901234567890", // Example DeFi contract
      value: ethers.utils.parseEther("1000").toString(), // 1000 tokens
      nonce: 0,
      deadline: Math.floor(Date.now() / 1000) + 3600, // 1 hour from now
    };

    const tokenAddress = "0xA0b86a33E6441e8e90Cc6ba448EBc9B5d2e70000"; // Example token

    console.log("3️⃣ Signing permit...");
    console.log(`   Token: ${tokenAddress}`);
    console.log(`   Owner: ${permitData.owner}`);
    console.log(`   Spender: ${permitData.spender}`);
    console.log(
      `   Amount: ${ethers.utils.formatEther(permitData.value)} tokens`
    );
    console.log(
      `   Deadline: ${new Date(permitData.deadline * 1000).toLocaleString()}`
    );

    const permitSignature = await pkpManager.signERC2612Permit(
      userData.id,
      tokenAddress,
      permitData,
      "datil"
    );

    console.log(
      `✅ Permit signature: ${permitSignature.slice(
        0,
        20
      )}...${permitSignature.slice(-20)}\n`
    );

    console.log("💡 In production, this permit can be used by:");
    console.log("   • DeFi protocols for gasless token approvals");
    console.log("   • DEXes for gasless trading");
    console.log("   • Your backend to spend tokens on behalf of users");
    console.log("   • Meta-transaction relayers");

    console.log("\n🎉 ERC-2612 permit example completed!");
  } catch (error) {
    console.error("❌ Error in permit example:", error.message);
  }
}

// ================================
// RUN ALL EXAMPLES
// ================================

async function runAllExamples() {
  console.log("🎯 PKP Wallet SDK - Simple Examples\n");
  console.log("This demo shows how to use the PKP Wallet system for:");
  console.log("✅ Basic wallet creation and message signing");
  console.log("✅ Multi-chain operations");
  console.log("✅ EIP-712 structured data signing");
  console.log("✅ ERC-2612 gasless permits");
  console.log("\n" + "=".repeat(50));

  try {
    await basicExample();
    await multiChainExample();
    await eip712Example();
    await permitExample();

    console.log("\n" + "=".repeat(50));
    console.log("🎉 All examples completed successfully!");
    console.log("\n💡 Next steps:");
    console.log("• Check user-pkps.json to see stored wallet data");
    console.log("• Modify examples to test your own use cases");
    console.log("• Build your own app using the PKPWalletManager class");
    console.log("• See README.md for full API documentation");
  } catch (error) {
    console.error("❌ Failed to run examples:", error);
  }
}

// Run examples if this file is executed directly
if (require.main === module) {
  runAllExamples()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error("Fatal error:", error);
      process.exit(1);
    });
}

// Export individual examples for selective testing
export {
  basicExample,
  multiChainExample,
  eip712Example,
  permitExample,
  runAllExamples,
};
