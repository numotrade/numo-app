import { CurrencyAmount } from "@uniswap/sdk-core";
import JSBI from "jsbi";

import type { Currency } from "@/lib/types/currency";
import { parseUnits } from "viem";

/**
 * Parses a CurrencyAmount from the passed string.
 * Returns the CurrencyAmount, or undefined if parsing fails.
 */
export default function tryParseCurrencyAmount<TCurrency extends Currency>(
  value?: string,
  currency?: TCurrency,
): CurrencyAmount<TCurrency> | undefined {
  if (!value || !currency) {
    return undefined;
  }
  try {
    const typedValueParsed = parseUnits(
      value as `${number}`,
      currency.decimals,
    ).toString();
    if (typedValueParsed !== "0") {
      return CurrencyAmount.fromRawAmount(
        currency,
        JSBI.BigInt(typedValueParsed),
      );
    }
  } catch (error) {
    // fails if the user specifies too many decimal places of precision (or maybe exceed max uint?)
    console.debug(`Failed to parse input amount: "${value}"`, error);
  }
  return undefined;
}
