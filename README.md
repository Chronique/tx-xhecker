# 🛡️ TX Xhecker

**TX Xhecker** is a comprehensive Verification and Transaction Utility hub for the **Base** ecosystem, built as a Farcaster Mini App (v2). It enables users to verify their on-chain identity, check social scores, and execute optimized transactions through a unified interface.


![License](https://img.shields.io/badge/License-MIT-green)
[![Follow on X](https://img.shields.io/twitter/follow/adhichronique?style=social)](https://x.com/adhichronique)

---

## 🚀 Key Features

- **Identity & Verification Hub**:
  - **Neynar Profile Check**: Verify Farcaster profile status and social scores using the Neynar API.
  - **Base Verify**: Check and validate Base network identity and verification status.
  - **EAS Integration**: Verify on-chain credentials and attestations via the **Ethereum Attestation Service (EAS)**.
- **Transaction Boosting**:
  - **Paymaster Integration**: Execute optimized or gasless transactions on Base.
  - **Transaction Tracking**: Monitor and "boost" transaction visibility/execution status.
- **Social Scoring**:
  - **Gitcoin Passport**: Integrate Gitcoin Scorer to verify sybil resistance.
  - **Talent Protocol**: Check builder scores and reputation metrics.
- **Farcaster SDK v2 Native Features**: 
  - **Interactive UI**: Dynamic Primary Button customization.
  - **Tactile UX**: Haptic feedback for on-chain actions.
  - **Native Permissions**: Built-in support for camera and microphone access.

## 🛠️ Tech Stack

- **Framework**: [Next.js 15](https://nextjs.org/) (App Router)
- **APIs**: [Neynar](https://neynar.com/), [EAS](https://attest.sh/), [Gitcoin Passport](https://passport.gitcoin.co/)
- **Web3 Library**: [Wagmi](https://wagmi.sh/), [Viem](https://viem.sh/), [ConnectKit](https://docs.family.co/connectkit)
- **SDK**: [@farcaster/frame-sdk](https://farcaster.xyz/)
- **Styling**: [Tailwind CSS](https://tailwindcss.com/) & [Shadcn UI](https://ui.shadcn.com/)

## 📦 Getting Started

### Prerequisites
- Node.js 18.x or later
- API Keys for Neynar, Gitcoin, and Talent Protocol.

### Installation & Setup

1. **Clone the repository:**
   
   ```bash
   git clone [https://github.com/Chronique/tx-xhecker.git](https://github.com/Chronique/tx-xhecker.git)
   cd tx-xhecker
    ```


2. **Install dependencies:**

    ```bash

    npm install

    ```

3.  **Environment Setup: Create a .env.local file in the root directory:**

    ```bash
    NEXT_PUBLIC_WC_PROJECT_ID=your_project_id_here
    NEXT_PUBLIC_NEYNAR_API_KEY=your_project_id_here
    NEXT_PUBLIC_PAYMASTER_URL=your_project_id_here
    NEXT_PUBLIC_GITCOIN_API_KEY=your_project_id_here
    NEXT_PUBLIC_TALENT_API_KEY=your_project_id_here
    NEXT_PUBLIC_GITCOIN_SCORER_ID=your_project_id_here
    ```



4.  **Run Development Server:**
    ```bash

    npm run dev

    ```

    Open http://localhost:3000  to see the result.

    ---



📂 **Project Structure**


    

    src/
    ├── app/            # Next.js App Router, Layouts, and Frame Metadata
    ├── components/     # Reusable UI & Logical Components
    │   ├── actions/    # SDK Actions (Swap, Send, Haptics, Camera)
    │   ├── providers/  # Context Providers (Wagmi, Frame SDK, Eruda)
    │   └── wallet/     # Wallet-specific UI (BasePay, TipBox, WalletActions)
    ├── lib/            # Shared utilities and formatters
    └── public/         # Static assets and branding
    
   

🤝 **Contributing**

Contributions are what make the open-source community such an amazing place to learn, inspire, and create. Any contributions you make are greatly appreciated.

* **Fork the Project**

* **Create your Feature Branch (git checkout -b feature/AmazingFeature)**

* **Commit your Changes (git commit -m 'Add some AmazingFeature')**

* **Push to the Branch (git push origin feature/AmazingFeature)**

Open a Pull Request

📄 **License**

Distributed under the MIT License. See LICENSE for more information.

Built with 🔵 on Base by Chronique
