import { SphereConfig } from "./src/config";

// Example configuration for Sphere Key Manager
export const exampleConfig: SphereConfig = {
  // Your external authentication API endpoint
  // This should point to your backend that handles username/password + OTP authentication
  apiEndpoint: "https://your-api.com",

  // Lit Protocol Network
  // Options: 'datil-dev' (development), 'datil-test' (testnet), 'mainnet' (production)
  litNetwork: "datil-dev",

  // Default blockchain chain for operations
  // Options: 'ethereum', 'polygon', 'arbitrum', etc.
  defaultChain: "ethereum",

  // Lit Protocol Relay API Key (optional but recommended for production)
  // Get this from https://developer.litprotocol.com/
  relayApiKey: "your-lit-relay-api-key",

  // Enable debug logging
  debug: true,
};

// Your external API should implement these endpoints:

/* 
POST /login
Body: { username: string, password: string, otpCode?: string }
Response: { success: boolean, token?: string, userId?: string, message?: string }

POST /verify-token  
Headers: { Authorization: "Bearer <token>" }
Body: { userId: string, timestamp: number, action: string }
Response: { success: boolean, userId?: string }

POST /refresh-token
Headers: { Authorization: "Bearer <token>" }
Response: { success: boolean, token?: string, userId?: string }

POST /check-permissions (optional)
Headers: { Authorization: "Bearer <token>" }
Body: { userId: string, action: string, timestamp: number }
Response: { authorized: boolean }
*/
