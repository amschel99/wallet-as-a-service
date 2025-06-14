# Sphere Key Management System

A comprehensive key management solution that bridges traditional authentication (username/password + OTP) with Web3 signing capabilities using **Lit Protocol**.

## 🌟 Features

- **🔐 External Authentication Integration** - Username/password + OTP verification
- **🔑 PKP (Programmable Key Pair) Management** - Secure threshold cryptography
- **💾 Encrypted Key Storage** - Store secrets on Lit Network with access control
- **✍️ Transaction Signing** - Sign EVM transactions securely
- **📝 Data Signing** - Sign arbitrary data using PKPs
- **🔄 Session Management** - Auto token refresh and secure logout
- **🎭 Mock Testing** - Complete mock system for local development

## 📦 Installation

```bash
npm install
```

## 🎯 Quick Start

### Option 1: Mock Testing (Recommended for Development)

Test all features locally without external APIs:

```bash
# Run the mock demo
npm run mock

# Or run the basic usage example with mocks
npm run demo
```

### Option 2: Production Setup

For production use with real external APIs:

```typescript
import { SphereKeyManager } from "./src/index";

const keyManager = new SphereKeyManager(
  "ethereum", // Chain
  "https://your-api.com" // Your auth API endpoint
);
```

## 🎭 Mock System

The mock system provides complete functionality without requiring external services:

### Available Mock Users

| Username  | Password      | OTP Code | Permissions                               | Status   |
| --------- | ------------- | -------- | ----------------------------------------- | -------- |
| demo_user | demo_password | 123456   | create-pkp, sign-transaction, data-access | Active   |
| alice     | alice123      | 654321   | data-access                               | Active   |
| bob       | bob456        | -        | create-pkp, sign-transaction              | Inactive |

### Mock Features

- ✅ **Authentication** - Complete user session management
- ✅ **PKP Creation** - Mock programmable key pairs
- ✅ **Key Storage** - Local encrypted storage simulation
- ✅ **Transaction Signing** - Mock ECDSA signatures
- ✅ **Data Signing** - Mock arbitrary data signing
- ✅ **Permission System** - Role-based access control

## 📖 Usage Examples

### Basic Authentication & PKP Creation

```typescript
import { MockSphereKeyManager } from "./src/mockIndex";

const keyManager = new MockSphereKeyManager("ethereum", "https://mock-api.com");

// Connect
await keyManager.connect();

// Authenticate
const auth = await keyManager.authenticateUser({
  username: "demo_user",
  password: "demo_password",
  otpCode: "123456",
});

// Create PKP
const pkp = await keyManager.createUserPKP();
console.log("PKP Address:", pkp.ethAddress);
```

### Key Storage & Retrieval

```typescript
// Store encrypted data
await keyManager.storeKey("api-key", {
  service: "OpenAI",
  key: "sk-1234567890",
  permissions: ["read", "write"],
});

// Retrieve data
const data = await keyManager.retrieveKey("api-key");
console.log("Retrieved:", data);
```

### Transaction Signing

```typescript
// Sign a transaction
const signature = await keyManager.signTransaction({
  to: "0x742d35Cc6634C0532925a3b8D3aC3Cf79Cc9F9C4",
  value: "1000000000000000000", // 1 ETH
  chainId: 1,
});

console.log("Signature:", signature);
```

### Data Signing

```typescript
// Sign arbitrary data
const dataSignature = await keyManager.signData("Hello, Sphere!");
console.log("Data signature:", dataSignature);
```

## 🔧 Configuration

### Environment Variables

```bash
# Your external authentication API endpoint
SPHERE_API_ENDPOINT=https://your-api.com

# Lit Protocol Network
LIT_NETWORK=datil-dev

# Default blockchain
DEFAULT_CHAIN=ethereum

# Lit Protocol Relay API Key
LIT_RELAY_API_KEY=your-api-key

# Debug mode
DEBUG=true
```

### Required API Endpoints

Your external authentication API should implement:

```typescript
// POST /login
{
  username: string,
  password: string,
  otpCode?: string
}
// Response: { success: boolean, token?: string, userId?: string }

// POST /verify-token
// Headers: Authorization: Bearer <token>
{
  userId: string,
  timestamp: number,
  action: string
}
// Response: { success: boolean, userId?: string }

// POST /refresh-token
// Headers: Authorization: Bearer <token>
// Response: { success: boolean, token?: string, userId?: string }
```

## 🏗️ Architecture

### Core Components

1. **SphereKeyManager** - Main production class
2. **MockSphereKeyManager** - Complete mock implementation
3. **External Authentication** - API integration layer
4. **Lit Actions** - Code that runs on Lit nodes
5. **PKP Management** - Programmable key pair handling

### File Structure

```
src/
├── index.ts           # Main SphereKeyManager
├── mockIndex.ts       # Mock implementation
├── auth.ts            # External auth integration
├── mockAuth.ts        # Mock auth system
├── litActions.ts      # Lit Action code
├── mockLitActions.ts  # Mock Lit Actions
├── types.ts           # TypeScript interfaces
└── config.ts          # Configuration management

examples/
└── basic-usage.ts     # Complete usage example

config.example.ts      # Configuration examples
```

## 🚀 Scripts

```bash
# Development with real Lit Protocol
npm run dev

# Mock testing (recommended for development)
npm run mock

# Run examples
npm run demo
```

## 🔒 Security Features

- **Double Authentication** - External API + Lit Protocol verification
- **Threshold Cryptography** - PKPs use distributed key management
- **Encrypted Storage** - All data encrypted on Lit Network
- **Access Control** - Fine-grained permission system
- **Session Security** - Auto token refresh and secure logout

## 🧪 Testing

The mock system allows you to test all features without:

- External API dependencies
- Lit Protocol network access
- Real cryptocurrency transactions
- Complex setup requirements

Perfect for:

- Development and testing
- CI/CD pipelines
- Demo purposes
- Learning the system

## 📝 Next Steps

1. **Install dependencies**: `npm install`
2. **Try the mock demo**: `npm run mock`
3. **Explore the example**: `npm run demo`
4. **Set up your external API** following the required endpoints
5. **Configure for production** using real Lit Protocol

## 🤝 Contributing

Feel free to submit issues and enhancement requests!

## 📄 License

ISC License
