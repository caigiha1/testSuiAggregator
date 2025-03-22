import { useCallback } from "react";
import BigNumber from "bignumber.js";

BigNumber.config({
  EXPONENTIAL_AT: [-1000000, 1000000],
  DECIMAL_PLACES: 30,
  ROUNDING_MODE: BigNumber.ROUND_DOWN,
});

export function useNumberFormat() {
  const formatWithCommas = useCallback((value: string | number): string => {
    if (!value && value !== 0) return "";

    const bn = new BigNumber(value.toString());
    if (bn.isNaN()) return "";

    const parts = bn.toString().split(".");
    const integerPart = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    const decimalPart = parts[1] ? `.${parts[1]}` : "";

    return `${integerPart}${decimalPart}`;
  }, []);

  const parseFormattedValue = useCallback((formattedValue: string): string => {
    return formattedValue.replace(/,/g, "");
  }, []);

  return { formatWithCommas, parseFormattedValue };
}
