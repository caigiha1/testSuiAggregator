import { Aftermath, RouterCompleteTradeRoute } from "aftermath-ts-sdk";

const TOKEN_MAP: Record<string, string> = {
  SUI: "0x2::sui::SUI",
  CETUS:
    "0x06864a6f921804860930db6ddbe2e16acdf8504495ea7481637a1c8b9a8fe54b::cetus::CETUS",
};

export async function getSwapRoute(from: string, to: string, amount: string) {
  try {
    const afSdk = new Aftermath("MAINNET");
    await afSdk.init();

    const fromAddress = TOKEN_MAP[from] || TOKEN_MAP.SUI;
    const toAddress = TOKEN_MAP[to] || TOKEN_MAP.CETUS;

    const coin = afSdk.Coin();
    const router = afSdk.Router();

    const metadata = await coin.getCoinMetadata(fromAddress);
    const fromDecimals = metadata?.decimals || 9;

    let coinInAmount: bigint;
    if (amount && parseFloat(amount) > 0) {
      const normalizedAmount = parseFloat(amount) * Math.pow(10, fromDecimals);
      coinInAmount = BigInt(Math.floor(normalizedAmount));
    } else {
      coinInAmount = BigInt(0);
    }

    const route = await router.getCompleteTradeRouteGivenAmountIn({
      coinInType: fromAddress,
      coinOutType: toAddress,
      coinInAmount: coinInAmount,
    });

    return route;
  } catch (error) {
    console.error("Error getting swap route:", error);
    return { error: (error as Error).message };
  }
}

export async function generateTransaction({
  route,
  walletAddress,
  slippage = 0.01,
}: {
  route: RouterCompleteTradeRoute; // Use proper type from Aftermath SDK
  walletAddress: string;
  slippage?: number;
}) {
  try {
    const afSdk = new Aftermath("MAINNET");
    await afSdk.init();

    const router = afSdk.Router();

    const tx = await router.getTransactionForCompleteTradeRoute({
      walletAddress,
      completeRoute: route,
      slippage,
      isSponsoredTx: false,
    });

    return { success: true, transaction: tx };
  } catch (error) {
    console.error("Error generating transaction:", error);
    return {
      success: false,
      error: (error as Error).message,
    };
  }
}
