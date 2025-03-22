import { Aftermath } from "aftermath-ts-sdk";
import SwapContract from "./swap-contract";

type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>;

const TOKEN_MAP: Record<string, string> = {
  SUI: "0x2::sui::SUI",
  CETUS:
    "0x06864a6f921804860930db6ddbe2e16acdf8504495ea7481637a1c8b9a8fe54b::cetus::CETUS",
  // Add more tokens as needed
};

export default async function AftermathDataProvider(props: {
  searchParams?: SearchParams;
}) {
  try {
    const afSdk = new Aftermath("MAINNET");
    await afSdk.init();
    const searchParams = await props.searchParams;
    const from = (searchParams?.from as string) ?? "SUI";
    const to = (searchParams?.to as string) ?? "CETUS";
    const fromAddress = TOKEN_MAP[from] || TOKEN_MAP.SUI; // Fallback to SUI
    const toAddress = TOKEN_MAP[to] || TOKEN_MAP.CETUS;
    const coin = afSdk.Coin();
    const prices = afSdk.Prices();

    const priceInfoFrom = await prices.getCoinPriceInfo({
      coin: TOKEN_MAP[from],
    });

    const priceInfoTo = await prices.getCoinPriceInfo({
      coin: TOKEN_MAP[to],
    });

    const multiPrices = await prices.getCoinsToPrice({
      coins: [
        "0x2::sui::SUI",
        "0x06864a6f921804860930db6ddbe2e16acdf8504495ea7481637a1c8b9a8fe54b::cetus::CETUS",
      ],
    });

    const priceInfo = await coin.getPrice(fromAddress);
    const metadata = await coin.getCoinMetadata(fromAddress);
    const cetusMetadata = await coin.getCoinMetadata(toAddress);

    const decimals = await coin.getCoinsToDecimals({
      coins: [
        "0x2::sui::SUI",
        "0x06864a6f921804860930db6ddbe2e16acdf8504495ea7481637a1c8b9a8fe54b::cetus::CETUS",
      ],
    });

    const serializedData = {
      from,
      to,
      priceInfo: {
        price: priceInfo.price,
        priceChange24HoursPercentage: priceInfo.priceChange24HoursPercentage,
        priceInfoFrom,
        priceInfoTo,
        multiPrices,
      },
      metadata: metadata
        ? {
            name: metadata.name,
            symbol: metadata.symbol,
            decimals: metadata.decimals,
          }
        : null,
      cetusMetadata: cetusMetadata
        ? {
            name: cetusMetadata.name,
            symbol: cetusMetadata.symbol,
            decimals: cetusMetadata.decimals,
          }
        : null,
      decimals,
    };

    return <SwapContract aftermathData={serializedData} />;
  } catch (error) {
    console.error("Error fetching Aftermath data:", error);
    return <SwapContract aftermathError={(error as Error).message} />;
  }
}
