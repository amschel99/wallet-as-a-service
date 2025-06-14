import * as LitJsSdk from "@lit-protocol/lit-node-client";
import {
  LIT_NETWORK,
  LIT_ABILITY,
  AUTH_METHOD_TYPE,
  AUTH_METHOD_SCOPE,
} from "@lit-protocol/constants";
import { LitContracts } from "@lit-protocol/contracts-sdk";
import { AuthMethodType } from "@lit-protocol/constants";
import {
  createSiweMessageWithRecaps,
  generateAuthSig,
} from "@lit-protocol/auth-helpers";
import { LitActionResource } from "@lit-protocol/auth-helpers";
import { ethers } from "ethers";
import { getAuthIdByAuthMethod } from "@lit-protocol/lit-auth-client";
const privateKey =
  "";

async function initializeWallet() {
  if (!privateKey) {
    throw new Error("PRIVATE_KEY not found in environment variables");
  }

  // Initialize provider with explicit network configuration
  const provider = new ethers.JsonRpcProvider(
    "https://yellowstone-rpc.litprotocol.com/"
  );

  // Verify connection
  try {
    const network = await provider.getNetwork();
    console.log(
      "Connected to network:",
      network.name,
      "chainId:",
      network.chainId
    );
    const blockNumber = await provider.getBlockNumber();
    console.log("Provider connected successfully, latest block:", blockNumber);
  } catch (err) {
    throw new Error(`Failed to connect to provider: ${err.message}`);
  }

  // Create wallet with explicit provider connection
  const wallet = new ethers.Wallet(privateKey, provider);
  return wallet;
}   

async function initializeLitContracts(wallet) {
  try {
    // Initialize with custom configuration
    const contractClient = new LitContracts({
      signer: wallet,
      network: LIT_NETWORK.DatilTest,
    });

    // Workaround for signer/provider issue

    await contractClient.connect();

    console.log("Lit Contracts initialized successfully");
    return contractClient;
  } catch (err) {
    console.error("Error initializing LitContracts:", err);
    throw err;
  }
}

async function main() {
  try {
    // Initialize wallet with proper provider
    const wallet = await initializeWallet();
    console.log(`Using wallet: ${wallet.address}`);

    // Initialize Lit Node Client
    const client = new LitJsSdk.LitNodeClientNodeJs({
      alertWhenUnauthorized: false,
      litNetwork: LIT_NETWORK.DatilTest,
    });
    await client.connect();
    console.log("Connected to Lit Node Client");

    // Initialize Lit Contracts with workaround
    const contractClient = await initializeLitContracts(wallet);
    console.log("Connected to Lit Contracts");

    const resourceAbilities = [
      {
        resource: new LitActionResource("*"),
        ability: LIT_ABILITY.LitActionExecution,
      },
    ];

    // First, create an authSig for PKP minting
    const toSign = await createSiweMessageWithRecaps({
      uri: "https://your-app.com",
      expiration: new Date(Date.now() + 600000).toISOString(),
      resources: resourceAbilities,
      walletAddress: wallet.address,
      nonce: await client.getLatestBlockhash(),
      litNodeClient: client,
    });

    const authSig = await generateAuthSig({
      signer: wallet,
      toSign,
    });

    console.log("Generated authSig for PKP minting");

    // Create auth method with authSig (not sessionSigs)
    const authMethod = {
      authMethodType: AUTH_METHOD_TYPE.EthWallet,
      accessToken: JSON.stringify(authSig),
    };

    // Mint PKP using the authSig
    const mintInfo = await contractClient.mintWithAuth({
      authMethod: authMethod,
      scopes: [AUTH_METHOD_SCOPE.SignAnything],
    });

    console.log("Minted PKP:", mintInfo);

    // Now get session signatures for the PKP operations
    const sessionSigs = await client.getSessionSigs({
      chain: "ethereum",
      expiration: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
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
          walletAddress: wallet.address,
          nonce: await client.getLatestBlockhash(),
          litNodeClient: client,
        });
        return await generateAuthSig({
          signer: wallet,
          toSign,
        });
      },
    });

    console.log("Successfully obtained session signatures:", sessionSigs);

    //VERIFY PKP permissions
    const authId = await getAuthIdByAuthMethod(authMethod);
    let scopes =
      await contractClient.pkpPermissionsContract.read.getPermittedAuthMethodScopes(
        mintInfo.pkp.tokenId,
        AUTH_METHOD_TYPE.EthWallet,
        authId,
        3
      );
    console.log("Scopes:", scopes);
  } catch (err) {
    console.error("Error in main:", err);
    throw err;
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Fatal error:", err);
    process.exit(1);
  });
