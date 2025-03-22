This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Overview

- This project integrates the Sui Wallet with a trading system using the Sui TypeScript SDK. Users can connect their wallets, view balances, input trade amounts, and execute transactions efficiently.

## Features

- Wallet Authentication: Connect and authenticate with Sui Wallet.

- Balance Display: Show wallet balances with fiat values.

- Trade Execution: Calculate optimal trade routes and estimate trade metrics.

- Transaction Signing: Sign and submit transactions to the blockchain.

- Big Decimal Support: Handle large decimal values (e.g., 22,222,222.3333333333).

- Formatted Inputs: Auto-format number inputs similar to Minswap.

- Trade Adjustments: Input Half or Max amounts and switch trade direction.

