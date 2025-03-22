"use client";

import React, { useState } from "react";

import {
  ConnectButton,
  useCurrentAccount,
  useSuiClientQuery,
  useSignAndExecuteTransaction,
} from "@mysten/dapp-kit";
import {
  ArrowDown,
  ArrowDownUp,
  ChevronDown,
  Info,
  Settings,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Controller, ControllerRenderProps, useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useNumberFormat } from "@/hooks/big_number_format";
import { Coin, CoinsToPrice, RouterCompleteTradeRoute } from "aftermath-ts-sdk";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { generateTransaction, getSwapRoute } from "./actions";

interface SwapContractProps {
  aftermathData?: {
    from: string | string[];
    to: string | string[];
    priceInfo?: {
      price: number;
      priceChange24HoursPercentage: number;
      priceInfoFrom: {
        price: number;
        priceChange24HoursPercentage: number;
      };
      priceInfoTo: {
        price: number;
        priceChange24HoursPercentage: number;
      };
      multiPrices: CoinsToPrice;
    };
    metadata?: {
      name: string;
      symbol: string;
      decimals: number;
    } | null;
    cetusMetadata?: {
      name: string;
      symbol: string;
      decimals: number;
    } | null;
    decimals?: Record<string, number>;
  };
  aftermathError?: string;
}

const formSchema = z.object({
  fromAmount: z.string().regex(/^\d*\.?\d*$/, "Please enter a valid number"),
  toAmount: z.string().regex(/^\d*\.?\d*$/, "Please enter a valid number"),
});

const SUI_TYPE = "0x2::sui::SUI";

const SwapContract = ({ aftermathData }: SwapContractProps) => {
  const searchParams = useSearchParams();
  const searchFrom = searchParams.get("from");
  const searchTo = searchParams.get("to");

  const [swapRoute, setSwapRoute] = useState<
    RouterCompleteTradeRoute | { error: string }
  >();
  const { mutate: signAndExecute } = useSignAndExecuteTransaction();

  const currentAccount = useCurrentAccount();

  const { formatWithCommas, parseFormattedValue } = useNumberFormat();
  const { data: coinsData } = useSuiClientQuery(
    "getCoins",
    {
      owner: currentAccount?.address || "",
      coinType: SUI_TYPE,
    },
    {
      enabled: !!currentAccount?.address,
    }
  );

  const totalRawBalance = coinsData?.data.reduce((sum, coin) => {
    return sum + BigInt(coin.balance);
  }, BigInt(0));
  const normalizedBalance = Coin.balanceWithDecimals(
    totalRawBalance ? totalRawBalance : 0,
    9
  );

  const { control, watch, setValue } = useForm<z.infer<typeof formSchema>>({
    defaultValues: {
      fromAmount: formatWithCommas(""),
      toAmount: formatWithCommas(""),
    },
    mode: "onTouched",
    resolver: zodResolver(formSchema),
  });

  const pathname = usePathname();
  const { replace } = useRouter();

  const availableTokens = [
    { type: "0x2::sui::SUI", symbol: "SUI" },
    {
      type: "0x06864a6f921804860930db6ddbe2e16acdf8504495ea7481637a1c8b9a8fe54b::cetus::CETUS",
      symbol: "CETUS",
    },
  ];

  const handleTokenChange = (position: "from" | "to", tokenType: string) => {
    const params = new URLSearchParams(searchParams);
    if (position === "from") {
      params.set("from", tokenType);
    } else {
      params.set("to", tokenType);
    }

    replace(`${pathname}?${params.toString()}`);
  };

  const handleSwitchTokens = () => {
    if (!aftermathData) return;

    setValue("fromAmount", "");
    setValue("toAmount", "");

    const params = new URLSearchParams(searchParams);
    params.set("from", searchTo ?? String(aftermathData.to));
    params.set("to", searchFrom ?? String(aftermathData.from));

    replace(`${pathname}?${params.toString()}`);
  };

  function calculateTradeMetrics(tradeData: RouterCompleteTradeRoute) {
    if (!tradeData || !tradeData.routes || tradeData.routes.length === 0) {
      throw new Error("Invalid trade data provided.");
    }

    const bestRoute = tradeData.routes.reduce((best, route) => {
      return route.coinOut.amount > best.coinOut.amount ? route : best;
    }, tradeData.routes[0]);

    const totalInput = BigInt(tradeData.coinIn.amount);
    const totalOutput = BigInt(tradeData.coinOut.amount);
    const bestOutput = BigInt(bestRoute.coinOut.amount);

    const expectedPrice = Number(totalOutput) / Number(totalInput);

    const actualPrice = Number(bestRoute.spotPrice);

    const slippage = ((expectedPrice - actualPrice) / expectedPrice) * 100;

    const feeMultiplier = Math.round(
      (1 - tradeData.netTradeFeePercentage) * 10000
    );

    const minReceive = (bestOutput * BigInt(feeMultiplier)) / BigInt(10000);

    return {
      bestRoute,
      slippage: slippage.toFixed(4) + "%",
      minReceive: Coin.balanceWithDecimals(minReceive, 9).toString(),
    };
  }

  const handleAmountChange = async (
    e: React.ChangeEvent<HTMLInputElement>,
    field: ControllerRenderProps<
      {
        fromAmount: string;
        toAmount: string;
      },
      "fromAmount"
    >
  ) => {
    const rawValue = parseFormattedValue(e.target.value);
    const formattedValue = formatWithCommas(rawValue);
    field.onChange(formattedValue);

    if (parseFloat(rawValue) > 0) {
      try {
        const from = searchFrom ?? "SUI";
        const to = searchTo ?? "CETUS";
        const result = await getSwapRoute(from, to, rawValue);

        const bestTrade = calculateTradeMetrics(
          result as RouterCompleteTradeRoute
        );

        setSwapRoute(result);

        console.log("Best trade route:", bestTrade);
        if ("error" in result) {
          console.error("Error from server:", result.error);
        } else {
          setValue(
            "toAmount",
            formatWithCommas(
              Coin.balanceWithDecimals(
                result.coinOut.amount ? result.coinOut.amount : 0,
                9
              ).toString()
            )
          );
        }
      } catch (error) {
        console.error("Error calculating swap:", error);
      }
    } else {
      setValue("toAmount", "");
    }
  };

  const calculatePriceChangePercentage = () => {
    const fromValueUSD =
      parseFloat(parseFormattedValue(watch("fromAmount") || "0")) *
      (aftermathData?.priceInfo?.priceInfoFrom?.price || 0);

    const toValueUSD =
      parseFloat(parseFormattedValue(watch("toAmount") || "0")) *
      (aftermathData?.priceInfo?.priceInfoTo?.price || 0);

    if (!fromValueUSD || fromValueUSD === 0) return null;

    const percentageDiff = ((toValueUSD - fromValueUSD) / fromValueUSD) * 100;

    return {
      value: percentageDiff,
      formatted: `${percentageDiff > 0 ? "+" : ""}${percentageDiff.toFixed(
        2
      )}%`,
      positive: percentageDiff >= 0,
    };
  };

  const handleSwap = async () => {
    if (!currentAccount?.address || !swapRoute) return;

    try {
      const { success, transaction, error } = await generateTransaction({
        route: swapRoute as RouterCompleteTradeRoute,
        walletAddress: currentAccount.address,
        slippage: 0.5,
      });

      if (!success || !transaction) {
        throw new Error(error || "Failed to generate transaction");
      }

      // Execute the transaction
      await signAndExecute(
        {
          transaction: transaction,
        },
        {
          onSuccess: (result) => {
            console.log("Swap executed successfully:", result);
            setValue("fromAmount", "");
            setValue("toAmount", "");
          },
          onError: (error) => {
            console.error("Error executing swap:", error);
          },
        }
      );
    } catch (error) {
      console.error("Error in swap process:", error);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen py-2">
      <div className="flex flex-col items-center justify-center w-full max-w-4xl px-4 text-center">
        <h1 className="text-4xl font-semibold">My Sui Wallet App</h1>
        <span className="text-sm">(TRAN_MINH_QUYET)</span>
        {currentAccount ? "Connected" : "Connect"}
        <ConnectButton />
      </div>
      {currentAccount && (
        <>
          <div className="text-center my-4">
            <h3>Wallet Balance</h3>
            {coinsData !== undefined ? (
              <p style={{ fontSize: "24px", fontWeight: "bold" }}>
                {normalizedBalance} SUI
              </p>
            ) : (
              <p>Loading balance...</p>
            )}
          </div>
          <Card className="w-full max-w-md bg-black text-white border-gray-800">
            <CardContent className="p-0">
              <div className="flex items-center justify-between p-4 border-b border-gray-800">
                <div className="flex items-center gap-1">
                  <span className="font-semibold">Swap</span>
                  <ArrowDown className="h-4 w-4 ml-1" />
                </div>
                <div className="flex items-center gap-2">
                  <Settings className="h-4 w-4 text-gray-400" />
                  <span className="text-xs text-gray-400">0.5%</span>
                </div>
              </div>

              <div className="p-4 border-b border-gray-800">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-sm text-gray-400">You pay</span>
                  <div className="flex gap-2">
                    <button className="text-xs text-orange-400">Half</button>
                    <button className="text-xs text-orange-400">Max</button>
                  </div>
                </div>

                <Controller
                  name="fromAmount"
                  control={control}
                  render={({ field }) => (
                    <div className="mt-1">
                      <div className="flex justify-between">
                        <div className="flex items-center gap-2">
                          <div className="flex items-center gap-1 cursor-pointer">
                            {/* <span className="font-medium">{fromCoin}</span> */}
                            <div className="relative">
                              <div className="flex gap-2 items-center">
                                <select
                                  value={
                                    searchFrom ?? availableTokens[0].symbol
                                  }
                                  onChange={(e) =>
                                    handleTokenChange("from", e.target.value)
                                  }
                                  className="appearance-none bg-transparent border border-none p-2 rounded w-full"
                                >
                                  {availableTokens.map((token) => (
                                    <option
                                      key={token.type}
                                      value={token.symbol}
                                    >
                                      {token.symbol}
                                    </option>
                                  ))}
                                </select>
                                <ChevronDown className="h-4 w-4" />
                              </div>
                            </div>
                          </div>
                        </div>
                        <input
                          value={field.value}
                          onChange={async (e) =>
                            await handleAmountChange(e, field)
                          }
                          className="bg-transparent text-right text-2xl font-semibold w-1/2 focus:outline-none"
                          placeholder="0"
                        />
                      </div>
                      <div className="flex items-center mt-1">
                        <span className="text-xs text-gray-500">
                          {/* {fromAmount} */}
                        </span>
                        <span className="ml-auto text-xs text-gray-500">
                          ${" "}
                          {formatWithCommas(
                            (
                              parseFloat(
                                parseFormattedValue(watch("fromAmount") || "0")
                              ) *
                              (aftermathData?.priceInfo?.priceInfoFrom?.price ||
                                0)
                            ).toFixed(2)
                          )}
                        </span>
                      </div>
                    </div>
                  )}
                />
              </div>

              <div
                className="relative flex justify-center cursor-pointer hover:scale-110 transition-transform duration-200"
                onClick={handleSwitchTokens}
              >
                <div className="absolute -top-3 bg-black border border-gray-700 rounded-full p-1">
                  <ArrowDownUp className="h-5 w-5 text-white" />
                </div>
              </div>

              <div className="p-4 border-b border-gray-800 mt-4">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-sm text-gray-400">You receive</span>
                  <div className="flex gap-2">
                    <button className="text-xs text-orange-400">Half</button>
                    <button className="text-xs text-orange-400">Max</button>
                  </div>
                </div>

                <Controller
                  name="toAmount"
                  control={control}
                  render={({ field }) => (
                    <div className="mt-1">
                      <div className="flex justify-between">
                        <div className="flex items-center gap-2">
                          <div className="relative">
                            <div className="flex gap-2 items-center">
                              <select
                                value={searchTo ?? availableTokens[1].symbol}
                                onChange={(e) =>
                                  handleTokenChange("to", e.target.value)
                                }
                                className="appearance-none bg-transparent border p-2 rounded w-full"
                              >
                                {availableTokens.map((token) => (
                                  <option key={token.type} value={token.symbol}>
                                    {token.symbol}
                                  </option>
                                ))}
                              </select>
                              <ChevronDown className="h-4 w-4" />
                            </div>
                          </div>
                        </div>
                        <input
                          value={field.value}
                          onChange={(e) => {
                            const rawValue = parseFormattedValue(
                              e.target.value
                            );
                            const formattedValue = formatWithCommas(rawValue);
                            field.onChange(formattedValue);
                          }}
                          className="bg-transparent text-right text-2xl font-semibold w-1/2 focus:outline-none"
                          placeholder="0"
                        />
                      </div>
                      <div className="flex items-center mt-1">
                        <span className="text-xs text-gray-500">
                          {/* {toAmount} */}
                        </span>
                        <span className="ml-auto text-xs text-gray-500">
                          ${" "}
                          {formatWithCommas(
                            (
                              parseFloat(
                                parseFormattedValue(watch("toAmount") || "0")
                              ) *
                              (aftermathData?.priceInfo?.priceInfoTo.price || 0)
                            ).toFixed(2)
                          )}
                        </span>

                        <div className="px-4 text-xs">
                          <div className="flex justify-between items-center">
                            {(() => {
                              const priceChange =
                                calculatePriceChangePercentage();
                              if (!priceChange) return null;

                              return (
                                <span
                                  className={`text-xs font-medium ${
                                    priceChange.positive
                                      ? "text-green-500"
                                      : "text-red-500"
                                  }`}
                                >
                                  {priceChange.formatted}
                                </span>
                              );
                            })()}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                />
              </div>

              <div className="p-4 text-sm">
                <div className="flex justify-between items-center text-gray-400">
                  <span>1 CETUS = 0.04012897 SUI</span>
                  <ArrowDownUp className="h-4 w-4" />
                </div>

                <div className="flex justify-between items-center mt-2">
                  <span className="text-gray-400">Route</span>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger className="flex items-center gap-1">
                        <Info className="h-3 w-3 text-orange-400" />
                        <span className="text-orange-400">
                          2 splits, 3 hops
                        </span>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p className="text-xs">
                          Route splits across multiple pools for better rates
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
              </div>
            </CardContent>

            <CardFooter className="p-4 pt-0">
              <Button
                type="button"
                className="w-full bg-gray-700 hover:bg-gray-600 text-white py-6"
                onClick={handleSwap}
              >
                Trade
              </Button>
            </CardFooter>
          </Card>
        </>
      )}
    </div>
  );
};

export default SwapContract;
