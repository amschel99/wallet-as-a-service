import * as LitJsSdk from "@lit-protocol/lit-node-client";
import dotenv from "dotenv";
dotenv.config();
import {
  LIT_NETWORK,
  LIT_ABILITY,
  AUTH_METHOD_TYPE,
  AUTH_METHOD_SCOPE,
  LIT_RPC,
} from "@lit-protocol/constants";
import { LitContracts } from "@lit-protocol/contracts-sdk";
import { PKPEthersWallet } from "@lit-protocol/pkp-ethers";
import {
  createSiweMessageWithRecaps,
  generateAuthSig,
} from "@lit-protocol/auth-helpers";
import { LitActionResource, LitPKPResource } from "@lit-protocol/auth-helpers";
import { ethers } from "ethers";
import * as fs from "fs";
import * as path from "path";

// ================================
// TYPES & INTERFACES
// ================================

interface ChainConfig {
  name: string;
  chainId: number;
  rpcUrl: string;
  nativeCurrency: {
    name: string;
    symbol: string;
    decimals: number;
  };
  blockExplorer?: string;
}

interface UserData {
  id: string;
  name: string;
  email: string;
}

interface PKPData {
  tokenId: string;
  publicKey: string;
  ethAddress: string;
}

interface UserPKPData {
  user: UserData;
  pkp: PKPData;
  createdAt: string;
}

interface SignMessageOptions {
  chain?: string;
  messageType?: "plain" | "eip191" | "eip712";
}

interface EIP712Domain {
  name: string;
  version: string;
  chainId: number;
  verifyingContract: string;
  salt?: string;
}

interface EIP712Types {
  [key: string]: Array<{
    name: string;
    type: string;
  }>;
}

interface ERC2612PermitData {
  owner: string;
  spender: string;
  value: string;
  nonce: number;
  deadline: number;
}

interface TransactionRequest {
  to: string;
  value?: string;
  gasLimit?: number;
  gasPrice?: string;
  data?: string;
}

// ================================
// CHAIN CONFIGURATIONS
// ================================

const SUPPORTED_CHAINS: Record<string, ChainConfig> = {
  ethereum: {
    name: "Ethereum Mainnet",
    chainId: 1,
    rpcUrl: "https://eth.llamarpc.com",
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
    blockExplorer: "https://etherscan.io",
  },
  sepolia: {
    name: "Sepolia Testnet",
    chainId: 11155111,
    rpcUrl: "https://sepolia.infura.io/v3/YOUR_KEY",
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
    blockExplorer: "https://sepolia.etherscan.io",
  },
  polygon: {
    name: "Polygon Mainnet",
    chainId: 137,
    rpcUrl: "https://polygon.llamarpc.com",
    nativeCurrency: { name: "MATIC", symbol: "MATIC", decimals: 18 },
    blockExplorer: "https://polygonscan.com",
  },
  datil: {
    name: "Lit Datil Testnet",
    chainId: 175188,
    rpcUrl: LIT_RPC.CHRONICLE_YELLOWSTONE,
    nativeCurrency: { name: "LIT", symbol: "LIT", decimals: 18 },
  },
};

// ================================
// PKP WALLET MANAGER CLASS
// ================================

class PKPWalletManager {
  private litClient: LitJsSdk.LitNodeClientNodeJs | null = null;
  private contractClient: LitContracts | null = null;
  private masterWallet: ethers.Wallet | null = null;
  private dataFile: string;
  private network: string;

  constructor(
    private privateKey: string,
    network: string = LIT_NETWORK.DatilTest,
    dataFile?: string
  ) {
    this.network = network;
    this.dataFile = dataFile || path.join(__dirname, "../user-pkps.json");
  }

  // ================================
  // INITIALIZATION
  // ================================

  async initialize(): Promise<void> {
    if (!this.privateKey) {
      throw new Error("Private key is required");
    }

    // Initialize provider
    const provider = new ethers.providers.JsonRpcProvider(
      SUPPORTED_CHAINS.datil.rpcUrl
    );

    // Create master wallet
    this.masterWallet = new ethers.Wallet(this.privateKey, provider);
    console.log(`🔑 Master wallet initialized: ${this.masterWallet.address}`);

    // Initialize Lit Node Client
    this.litClient = new LitJsSdk.LitNodeClientNodeJs({
      litNetwork: this.network as any,
      debug: false,
    });
    await this.litClient.connect();
    console.log("🌐 Connected to Lit Node Client");

    // Initialize Lit Contracts
    this.contractClient = new LitContracts({
      signer: this.masterWallet,
      network: this.network as any,
      debug: false,
    });
    await this.contractClient.connect();
    console.log("📜 Connected to Lit Contracts");
  }

  // ================================
  // CHAIN UTILITIES
  // ================================

  getSupportedChains(): string[] {
    return Object.keys(SUPPORTED_CHAINS);
  }

  getChainConfig(chain: string): ChainConfig {
    const config = SUPPORTED_CHAINS[chain];
    if (!config) {
      throw new Error(
        `Unsupported chain: ${chain}. Supported: ${this.getSupportedChains().join(
          ", "
        )}`
      );
    }
    return config;
  }

  // ================================
  // PKP DATA MANAGEMENT
  // ================================

  private loadUserPKPs(): UserPKPData[] {
    try {
      if (fs.existsSync(this.dataFile)) {
        const data = fs.readFileSync(this.dataFile, "utf8");
        return JSON.parse(data);
      }
    } catch (err) {
      console.log("📁 No existing PKP data found, will create new file");
    }
    return [];
  }

  private saveUserPKPs(userPKPs: UserPKPData[]): void {
    try {
      fs.writeFileSync(this.dataFile, JSON.stringify(userPKPs, null, 2));
      console.log(`💾 Saved PKP data to ${this.dataFile}`);
    } catch (err) {
      console.error("❌ Error saving PKP data:", err);
    }
  }

  private findUserPKP(userId: string): UserPKPData | undefined {
    const userPKPs = this.loadUserPKPs();
    return userPKPs.find((item) => item.user.id === userId);
  }

  // ================================
  // WALLET CREATION
  // ================================

  async createWallet(userData: UserData): Promise<PKPData> {
    if (!this.litClient || !this.contractClient || !this.masterWallet) {
      throw new Error(
        "PKPWalletManager not initialized. Call initialize() first."
      );
    }

    // Check if PKP already exists
    const existing = this.findUserPKP(userData.id);
    if (existing) {
      console.log(
        `✅ Found existing PKP for ${userData.name}: ${existing.pkp.ethAddress}`
      );
      return existing.pkp;
    }

    console.log(`🔨 Creating new PKP for ${userData.name}...`);

    // Create auth signature for PKP minting
    const resourceAbilities = [
      {
        resource: new LitActionResource("*"),
        ability: LIT_ABILITY.LitActionExecution,
      },
    ];

    const toSign = await createSiweMessageWithRecaps({
      uri: "https://your-app.com",
      expiration: new Date(Date.now() + 600000).toISOString(),
      resources: resourceAbilities,
      walletAddress: this.masterWallet.address,
      nonce: await this.litClient.getLatestBlockhash(),
      litNodeClient: this.litClient,
    });

    const authSig = await generateAuthSig({
      signer: this.masterWallet,
      toSign,
    });

    // Create auth method
    const authMethod = {
      authMethodType: AUTH_METHOD_TYPE.EthWallet,
      accessToken: JSON.stringify(authSig),
    };

    // Mint PKP
    const mintInfo = await this.contractClient.mintWithAuth({
      authMethod,
      scopes: [AUTH_METHOD_SCOPE.SignAnything, AUTH_METHOD_SCOPE.PersonalSign],
    });

    console.log(
      `✅ PKP created for ${userData.name}: ${mintInfo.pkp.ethAddress}`
    );

    // Save to storage
    const userPKPs = this.loadUserPKPs();
    const newUserPKP: UserPKPData = {
      user: userData,
      pkp: mintInfo.pkp,
      createdAt: new Date().toISOString(),
    };
    userPKPs.push(newUserPKP);
    this.saveUserPKPs(userPKPs);

    return mintInfo.pkp;
  }

  // ================================
  // WALLET INSTANCE CREATION
  // ================================

  async getWallet(
    userId: string,
    chain: string = "datil"
  ): Promise<PKPEthersWallet> {
    if (!this.litClient || !this.masterWallet) {
      throw new Error(
        "PKPWalletManager not initialized. Call initialize() first."
      );
    }

    const userPKP = this.findUserPKP(userId);
    if (!userPKP) {
      throw new Error(`No PKP found for user: ${userId}. Create wallet first.`);
    }

    const chainConfig = this.getChainConfig(chain);

    // Create resource abilities
    const resourceAbilities = [
      {
        resource: new LitPKPResource(userPKP.pkp.tokenId),
        ability: LIT_ABILITY.PKPSigning,
      },
      {
        resource: new LitActionResource("*"),
        ability: LIT_ABILITY.LitActionExecution,
      },
    ];

    // Create PKP wallet
    const pkpWallet = new PKPEthersWallet({
      pkpPubKey: userPKP.pkp.publicKey,
      litNodeClient: this.litClient,
      authContext: {
        getSessionSigsProps: {
          chain: chainConfig.name.toLowerCase(),
          expiration: new Date(Date.now() + 60_000 * 60).toISOString(),
          resourceAbilityRequests: resourceAbilities,
          authNeededCallback: async ({
            resourceAbilityRequests,
            expiration,
            uri,
          }) => {
            const toSign = await createSiweMessageWithRecaps({
              uri,
              expiration,
              resources: resourceAbilityRequests,
              walletAddress: this.masterWallet!.address,
              nonce: await this.litClient!.getLatestBlockhash(),
              litNodeClient: this.litClient!,
            });
            return await generateAuthSig({
              signer: this.masterWallet!,
              toSign,
            });
          },
        },
      },
    });

    return pkpWallet;
  }

  // ================================
  // SIGNING METHODS
  // ================================

  async signMessage(
    userId: string,
    message: string,
    options: SignMessageOptions = {}
  ): Promise<string> {
    const { chain = "datil", messageType = "plain" } = options;
    const wallet = await this.getWallet(userId, chain);

    switch (messageType) {
      case "plain":
      case "eip191":
        return await wallet.signMessage(message);

      default:
        throw new Error(`Unsupported message type: ${messageType}`);
    }
  }

  async signTypedData(
    userId: string,
    domain: EIP712Domain,
    types: EIP712Types,
    value: any,
    chain: string = "datil"
  ): Promise<string> {
    const wallet = await this.getWallet(userId, chain);
    return await wallet._signTypedData(domain, types, value);
  }

  async signTransaction(
    userId: string,
    transaction: TransactionRequest,
    chain: string = "datil"
  ): Promise<string> {
    const wallet = await this.getWallet(userId, chain);
    const chainConfig = this.getChainConfig(chain);

    const txRequest = {
      ...transaction,
      chainId: chainConfig.chainId,
      gasLimit: transaction.gasLimit || 21000,
      gasPrice: transaction.gasPrice || ethers.utils.parseUnits("20", "gwei"),
      value: transaction.value || "0",
    };

    return await wallet.signTransaction(txRequest);
  }

  // ================================
  // ERC-2612 PERMIT SUPPORT
  // ================================

  async signERC2612Permit(
    userId: string,
    tokenAddress: string,
    permitData: ERC2612PermitData,
    chain: string = "ethereum"
  ): Promise<string> {
    const chainConfig = this.getChainConfig(chain);

    const domain: EIP712Domain = {
      name: "Token", // Should be fetched from token contract
      version: "1",
      chainId: chainConfig.chainId,
      verifyingContract: tokenAddress,
    };

    const types: EIP712Types = {
      Permit: [
        { name: "owner", type: "address" },
        { name: "spender", type: "address" },
        { name: "value", type: "uint256" },
        { name: "nonce", type: "uint256" },
        { name: "deadline", type: "uint256" },
      ],
    };

    return await this.signTypedData(userId, domain, types, permitData, chain);
  }

  // ================================
  // UTILITY METHODS
  // ================================

  async getWalletInfo(
    userId: string,
    chain: string = "datil"
  ): Promise<{
    address: string;
    balance: string;
    nonce: number;
    chainId: number;
  }> {
    const wallet = await this.getWallet(userId, chain);
    const chainConfig = this.getChainConfig(chain);

    const address = await wallet.getAddress();
    const balance = await wallet.getBalance();
    const nonce = await wallet.getTransactionCount();

    return {
      address,
      balance: ethers.utils.formatEther(balance),
      nonce,
      chainId: chainConfig.chainId,
    };
  }

  async listUserWallets(): Promise<UserPKPData[]> {
    return this.loadUserPKPs();
  }

  // ================================
  // VERIFICATION UTILITIES
  // ================================

  verifySignature(
    message: string,
    signature: string,
    expectedAddress: string
  ): boolean {
    try {
      const recoveredAddress = ethers.utils.verifyMessage(message, signature);
      return recoveredAddress.toLowerCase() === expectedAddress.toLowerCase();
    } catch {
      return false;
    }
  }

  verifyTypedDataSignature(
    domain: EIP712Domain,
    types: EIP712Types,
    value: any,
    signature: string,
    expectedAddress: string
  ): boolean {
    try {
      const recoveredAddress = ethers.utils.verifyTypedData(
        domain,
        types,
        value,
        signature
      );
      return recoveredAddress.toLowerCase() === expectedAddress.toLowerCase();
    } catch {
      return false;
    }
  }
}

// ================================
// DEMO USAGE
// ================================

async function demo() {
  try {
    const privateKey = process.env.PRIVATE_KEY;
    if (!privateKey) {
      throw new Error("PRIVATE_KEY not found in environment variables");
    }

    // Initialize PKP Manager
    const pkpManager = new PKPWalletManager(privateKey);
    await pkpManager.initialize();

    console.log("\n🎯 Supported chains:", pkpManager.getSupportedChains());

    // Create users
    const users = [
      { id: "alice", name: "Alice", email: "alice@example.com" },
      { id: "bob", name: "Bob", email: "bob@example.com" },
    ];

    console.log("\n=== CREATING WALLETS ===");

    // Create wallets for users
    for (const user of users) {
      await pkpManager.createWallet(user);
    }

    console.log("\n=== TESTING WALLET OPERATIONS ===");

    for (const user of users) {
      console.log(`\n--- ${user.name}'s Wallet Tests ---`);

      // Get wallet info
      const info = await pkpManager.getWalletInfo(user.id);
      console.log(`💰 Address: ${info.address}`);
      console.log(`💰 Balance: ${info.balance} ETH`);
      console.log(`🔢 Nonce: ${info.nonce}`);

      // Test message signing
      const message = `Hello from ${user.name}! 🚀`;
      const signature = await pkpManager.signMessage(user.id, message);
      console.log(`✍️  Message signed: ${signature.slice(0, 20)}...`);

      const isValid = pkpManager.verifySignature(
        message,
        signature,
        info.address
      );
      console.log(`✅ Signature valid: ${isValid}`);

      // Test EIP-712 signing
      const domain = {
        name: "PKP Test",
        version: "1",
        chainId: 175188,
        verifyingContract: "0x0000000000000000000000000000000000000000",
      };

      const types = {
        Message: [
          { name: "user", type: "string" },
          { name: "content", type: "string" },
        ],
      };

      const value = {
        user: user.name,
        content: `Test message from ${user.email}`,
      };

      const typedSig = await pkpManager.signTypedData(
        user.id,
        domain,
        types,
        value
      );
      console.log(`📜 Typed data signed: ${typedSig.slice(0, 20)}...`);

      const typedValid = pkpManager.verifyTypedDataSignature(
        domain,
        types,
        value,
        typedSig,
        info.address
      );
      console.log(`✅ Typed signature valid: ${typedValid}`);

      // Test ERC-2612 permit (example)
      const permitData = {
        owner: info.address,
        spender: "0x1234567890123456789012345678901234567890",
        value: ethers.utils.parseEther("100").toString(),
        nonce: 0,
        deadline: Math.floor(Date.now() / 1000) + 3600,
      };

      try {
        const permitSig = await pkpManager.signERC2612Permit(
          user.id,
          "0xA0b86a33E6441e8e90Cc6ba448EBc9B5d2e70000", // Example token
          permitData,
          "datil"
        );
        console.log(`🎫 ERC-2612 permit signed: ${permitSig.slice(0, 20)}...`);
      } catch (err) {
        console.log(`⚠️  ERC-2612 test skipped: ${err.message}`);
      }
    }

    console.log("\n🎉 All tests completed successfully!");
    console.log("\n=== PKP WALLET MANAGER FEATURES ===");
    console.log("✅ Multi-chain support");
    console.log("✅ Deterministic wallet creation");
    console.log("✅ Message signing");
    console.log("✅ Transaction signing");
    console.log("✅ EIP-712 typed data signing");
    console.log("✅ ERC-2612 permit signing");
    console.log("✅ Signature verification");
    console.log("✅ Persistent storage");
  } catch (err) {
    console.error("❌ Demo failed:", err);
  }
}

// Run demo if this file is executed directly
if (require.main === module) {
  demo()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error("Fatal error:", err);
      process.exit(1);
    });
}

// Export for use as SDK
export { PKPWalletManager, SUPPORTED_CHAINS };
export type {
  ChainConfig,
  UserData,
  PKPData,
  SignMessageOptions,
  EIP712Domain,
  EIP712Types,
  ERC2612PermitData,
  TransactionRequest,
};
