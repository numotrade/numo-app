import type { Protocol } from "../constants";
import {
  calculateEstimatedBurnAmount,
  calculateEstimatedPairBurnAmount,
  calculateEstimatedTokensOwed,
  calculateEstimatedWithdrawAmount,
} from "../lib/amounts";
import type { Lendgine } from "../lib/types/lendgine";
import type { HookArg } from "./internal/types";
import { useBalance } from "./useBalance";
import { useMostLiquidMarket } from "./useExternalExchange";
import { useLendgine } from "./useLendgine";
import { useLendginePosition } from "./useLendginePosition";
import { scale } from "@/lib/constants";
import { fractionToPrice, priceToFraction } from "@/lib/price";
import { CurrencyAmount, Fraction, Percent } from "@uniswap/sdk-core";
import { useMemo } from "react";
import { useAccount } from "wagmi";

export const useValue = <L extends Lendgine>(
  lendgine: HookArg<L>,
  protocol: Protocol,
) => {
  const { address } = useAccount();

  const balanceQuery = useBalance(lendgine?.lendgine, address);
  const lendgineInfoQuery = useLendgine(lendgine);

  const priceQuery = useMostLiquidMarket(
    lendgine ? { quote: lendgine.token0, base: lendgine.token1 } : undefined,
  );

  return useMemo(() => {
    if (
      balanceQuery.isLoading ||
      lendgineInfoQuery.isLoading ||
      priceQuery.status === "loading"
    )
      return { status: "loading" } as const;

    if (
      !lendgine ||
      !lendgineInfoQuery.data ||
      !priceQuery.data ||
      !balanceQuery.data
    )
      return { status: "error" } as const;

    const { collateral, liquidity } = calculateEstimatedBurnAmount(
      lendgine,
      lendgineInfoQuery.data,
      balanceQuery.data,
      protocol,
    );
    const { amount0, amount1 } = calculateEstimatedPairBurnAmount(
      lendgine,
      lendgineInfoQuery.data,
      liquidity,
    );

    const value = priceQuery.data.price
      .quote(collateral)
      .subtract(amount0.add(priceQuery.data.price.quote(amount1)));

    return { status: "success", value } as const;
  }, [
    balanceQuery.data,
    balanceQuery.isLoading,
    lendgine,
    lendgineInfoQuery.data,
    lendgineInfoQuery.isLoading,
    priceQuery.data,
    priceQuery.status,
    protocol,
  ]);
};

export const useTotalValue = <L extends Lendgine>(
  lendgine: HookArg<L>,
  protocol: Protocol,
) => {
  const lendgineInfoQuery = useLendgine(lendgine);

  const priceQuery = useMostLiquidMarket(
    lendgine ? { quote: lendgine.token0, base: lendgine.token1 } : undefined,
  );

  return useMemo(() => {
    if (lendgineInfoQuery.isLoading || priceQuery.status === "loading")
      return { status: "loading" } as const;

    if (!lendgine || !lendgineInfoQuery.data || !priceQuery.data)
      return { status: "error" } as const;

    const { collateral, liquidity } = calculateEstimatedBurnAmount(
      lendgine,
      lendgineInfoQuery.data,
      lendgineInfoQuery.data.totalSupply,
      protocol,
    );
    const { amount0, amount1 } = calculateEstimatedPairBurnAmount(
      lendgine,
      lendgineInfoQuery.data,
      liquidity,
    );

    const value = priceQuery.data.price
      .quote(collateral)
      .subtract(amount0.add(priceQuery.data.price.quote(amount1)));

    return { status: "success", value } as const;
  }, [
    lendgine,
    lendgineInfoQuery.data,
    lendgineInfoQuery.isLoading,
    priceQuery.data,
    priceQuery.status,
    protocol,
  ]);
};

export const usePositionValue = <L extends Lendgine>(
  lendgine: HookArg<L>,
  protocol: Protocol,
) => {
  const { address } = useAccount();

  const positionQuery = useLendginePosition(lendgine, address, protocol);
  const lendgineInfoQuery = useLendgine(lendgine);

  const priceQuery = useMostLiquidMarket(
    lendgine ? { quote: lendgine.token0, base: lendgine.token1 } : undefined,
  );

  return useMemo(() => {
    if (
      positionQuery.isLoading ||
      lendgineInfoQuery.isLoading ||
      priceQuery.status === "loading"
    )
      return { status: "loading" } as const;

    if (
      !lendgine ||
      !lendgineInfoQuery.data ||
      !priceQuery.data ||
      !positionQuery.data
    )
      return { status: "error" } as const;

    const { liquidity } = calculateEstimatedWithdrawAmount(
      lendgine,
      lendgineInfoQuery.data,
      positionQuery.data,
      protocol,
    );
    const { amount0, amount1 } = calculateEstimatedPairBurnAmount(
      lendgine,
      lendgineInfoQuery.data,
      liquidity,
    );
    const tokensOwed = calculateEstimatedTokensOwed(
      lendgine,
      lendgineInfoQuery.data,
      positionQuery.data,
      protocol,
    );

    const value = amount0.add(
      priceQuery.data.price.quote(amount1.add(tokensOwed)),
    );

    return { status: "success", value } as const;
  }, [
    lendgine,
    lendgineInfoQuery.data,
    lendgineInfoQuery.isLoading,
    positionQuery.data,
    positionQuery.isLoading,
    priceQuery.data,
    priceQuery.status,
    protocol,
  ]);
};

export const useTotalPositionValue = <L extends Lendgine>(
  lendgine: HookArg<L>,
  protocol: Protocol,
) => {
  const lendgineInfoQuery = useLendgine(lendgine);

  const priceQuery = useMostLiquidMarket(
    lendgine ? { quote: lendgine.token0, base: lendgine.token1 } : undefined,
  );

  return useMemo(() => {
    if (lendgineInfoQuery.isLoading || priceQuery.status === "loading")
      return { status: "loading" } as const;

    if (!lendgine || !lendgineInfoQuery.data || !priceQuery.data)
      return { status: "error" } as const;

    const { liquidity } = calculateEstimatedWithdrawAmount(
      lendgine,
      lendgineInfoQuery.data,
      { size: lendgineInfoQuery.data.totalPositionSize },
      protocol,
    );
    const { amount0, amount1 } = calculateEstimatedPairBurnAmount(
      lendgine,
      lendgineInfoQuery.data,
      liquidity,
    );

    const value = amount0.add(priceQuery.data.price.quote(amount1));

    return { status: "success", value } as const;
  }, [
    lendgine,
    lendgineInfoQuery.data,
    lendgineInfoQuery.isLoading,
    priceQuery.data,
    priceQuery.status,
    protocol,
  ]);
};

export const useTokensOwed = <L extends Lendgine>(
  lendgine: HookArg<L>,
  protocol: Protocol,
) => {
  const { address } = useAccount();

  const positionQuery = useLendginePosition(lendgine, address, protocol);
  const lendgineInfoQuery = useLendgine(lendgine);

  const priceQuery = useMostLiquidMarket(
    lendgine ? { quote: lendgine.token0, base: lendgine.token1 } : undefined,
  );

  return useMemo(() => {
    if (
      positionQuery.isLoading ||
      lendgineInfoQuery.isLoading ||
      priceQuery.status === "loading"
    )
      return { status: "loading" } as const;

    if (
      !lendgine ||
      !lendgineInfoQuery.data ||
      !priceQuery.data ||
      !positionQuery.data
    )
      return { status: "error" } as const;

    const tokensOwed = calculateEstimatedTokensOwed(
      lendgine,
      lendgineInfoQuery.data,
      positionQuery.data,
      protocol,
    );

    return { status: "success", tokensOwed } as const;
  }, [
    lendgine,
    lendgineInfoQuery.data,
    lendgineInfoQuery.isLoading,
    positionQuery.data,
    positionQuery.isLoading,
    priceQuery.data,
    priceQuery.status,
    protocol,
  ]);
};

export const useInterestPremium = <L extends Lendgine>(
  lendgine: HookArg<L>,
) => {
  const lendgineInfoQuery = useLendgine(lendgine);
  const priceQuery = useMostLiquidMarket(
    lendgine ? { quote: lendgine.token0, base: lendgine.token1 } : undefined,
  );

  return useMemo(() => {
    if (
      priceQuery.status === "loading" ||
      lendgineInfoQuery.status === "loading"
    )
      return { status: "loading" } as const;

    if (!priceQuery.data || !lendgine || !lendgineInfoQuery.data)
      return { status: "error" } as const;

    const liquidity = CurrencyAmount.fromRawAmount(lendgine.lendgine, scale);
    const collateral = fractionToPrice(
      priceToFraction(lendgine.bound).multiply(2),
      lendgine.lendgine,
      lendgine.token1,
    ).quote(liquidity);

    const { amount0, amount1 } = calculateEstimatedPairBurnAmount(
      lendgine,
      lendgineInfoQuery.data,
      liquidity,
    );

    const ptValue = priceQuery.data.price
      .quote(collateral)
      .subtract(amount0.add(priceQuery.data.price.quote(amount1)));

    const lpValue = amount0.add(priceQuery.data.price.quote(amount1));

    const f = lpValue.equalTo(0) ? new Fraction(1) : ptValue.divide(lpValue);

    return {
      status: "success",
      value: new Percent(f.numerator, f.denominator),
    } as const;
  }, [
    lendgine,
    lendgineInfoQuery.status,
    lendgineInfoQuery.data,
    priceQuery.status,
    priceQuery.data,
  ]);
};
