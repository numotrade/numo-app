import { uniswapV2PairABI } from "../abis/uniswapV2Pair";
import { uniswapV3PoolABI } from "../abis/uniswapV3Pool";
import { useEnvironment } from "../contexts/environment";
import { UniswapV2Pool, parsePriceHistoryHourV2 } from "../graphql/uniswapV2";
import { UniswapV3Pool, parsePriceHistoryHourV3 } from "../graphql/uniswapV3";
import { Q192, feeTiers } from "../graphql/uniswapV3";
import type { Market } from "../lib/types/market";
import {
  calcMedianPrice,
  calcV2Address,
  calcV3Address,
  sortTokens,
} from "../lib/uniswap";
import type { HookArg, ReadConfig } from "./internal/types";
import { useContractRead } from "./internal/useContractRead";
import { useContractReads } from "./internal/useContractReads";
import { externalRefetchInterval } from "./internal/utils";
import { getBalanceRead } from "./useBalance";
import { useChain } from "./useChain";
import { useClient } from "./useClient";
import {
  PriceHistoryHourV2Document,
  PriceHistoryHourV2Query,
} from "@/gql/uniswapV2/graphql";
import { PriceHistoryHourV3Document } from "@/gql/uniswapV3/graphql";
import { useQuery } from "@tanstack/react-query";
import { CurrencyAmount, Fraction, Price } from "@uniswap/sdk-core";
import JSBI from "jsbi";
import { chunk } from "lodash";
import { useMemo } from "react";
import invariant from "tiny-invariant";
import { objectKeys } from "ts-extras";
import type { Address } from "wagmi";

export const isV3 = (t: UniswapV2Pool | UniswapV3Pool): t is UniswapV3Pool =>
  t.version === "V3";

export const useMostLiquidMarket = (market: HookArg<Market>) => {
  const environment = useEnvironment();

  const v2PriceQuery = useV2Price(market);
  const v3PriceQuery = useV3Price(market);

  const { contracts } = useMemo(() => {
    if (!market) return {};
    const sortedTokens = sortTokens([market.base, market.quote]);

    const v2Address = calcV2Address(
      sortedTokens,
      environment.interface.uniswapV2.factoryAddress,
      environment.interface.uniswapV2.pairInitCodeHash,
    ) as Address;
    const v3Addresses = objectKeys(feeTiers).map(
      (fee) =>
        calcV3Address(
          sortedTokens,
          fee,
          environment.interface.uniswapV3.factoryAddress,
          environment.interface.uniswapV3.pairInitCodeHash,
        ) as Address,
    );

    const contracts = [v2Address]
      .concat(v3Addresses)
      .flatMap((a) => [
        getBalanceRead(market.base, a),
        getBalanceRead(market.quote, a),
      ]);

    return { contracts, sortedTokens };
  }, [
    environment.interface.uniswapV2.factoryAddress,
    environment.interface.uniswapV2.pairInitCodeHash,
    environment.interface.uniswapV3.factoryAddress,
    environment.interface.uniswapV3.pairInitCodeHash,
    market,
  ]);

  const balancesQuery = useContractReads({
    allowFailure: true,
    contracts,
    staleTime: Infinity,
    enabled: !!contracts,
    refetchInterval: 1_000 * 60,
    select: (data) =>
      market
        ? data.map((d, i) =>
            d
              ? CurrencyAmount.fromRawAmount(
                  i % 2 === 0 ? market.base : market.quote,
                  d.toString(),
                )
              : undefined,
          )
        : undefined,
  });

  return useMemo(() => {
    if (
      v2PriceQuery.isLoading ||
      v3PriceQuery.isLoading ||
      balancesQuery.isLoading
    )
      return { status: "loading" } as const;
    if (v2PriceQuery.isError || v3PriceQuery.isError || balancesQuery.isError)
      return { status: "error" } as const;
    invariant(market);

    // token0 / token1
    const medianPrice = calcMedianPrice(
      v3PriceQuery.data.concat(v2PriceQuery.data),
      market,
    );

    const tvls = chunk(balancesQuery.data, 2).map((b) => {
      if (!b) return undefined;
      return b[1]!.add(medianPrice.quote(b[0]!));
    });

    const maxTVLIndex = tvls.reduce(
      (acc, cur, i) =>
        cur?.greaterThan(acc.max) ? { index: i, max: cur } : acc,
      { index: 0, max: CurrencyAmount.fromRawAmount(market.quote, 0) },
    );

    if (maxTVLIndex.index === 0)
      return {
        status: "success",
        data: {
          price: v2PriceQuery.data,
          pool: { version: "V2" } as UniswapV2Pool,
        },
      } as const;
    else {
      return {
        status: "success",
        data: {
          price: v3PriceQuery.data[maxTVLIndex.index - 1]!,
          pool: {
            version: "V3",
            feeTier: objectKeys(feeTiers)[maxTVLIndex.index - 1],
          } as UniswapV3Pool,
        },
      } as const;
    }
  }, [
    balancesQuery.data,
    balancesQuery.isError,
    balancesQuery.isLoading,
    market,
    v2PriceQuery.data,
    v2PriceQuery.isError,
    v2PriceQuery.isLoading,
    v3PriceQuery.data,
    v3PriceQuery.isError,
    v3PriceQuery.isLoading,
  ]);
};

export const usePriceHistory = (
  market: HookArg<Market>,
  externalExchange: HookArg<UniswapV2Pool | UniswapV3Pool>,
) => {
  const client = useClient();
  const chain = useChain();
  const environment = useEnvironment();

  return useQuery(
    ["price history", externalExchange, market, chain],
    async () => {
      invariant(externalExchange && market);

      const sortedTokens = sortTokens([market.base, market.quote]);
      const pairAddress = isV3(externalExchange)
        ? (calcV3Address(
            sortedTokens,
            externalExchange.feeTier,
            environment.interface.uniswapV3.factoryAddress,
            environment.interface.uniswapV3.pairInitCodeHash,
          ) as Address)
        : (calcV2Address(
            sortedTokens,
            environment.interface.uniswapV2.factoryAddress,
            environment.interface.uniswapV2.pairInitCodeHash,
          ) as Address);

      const variables = {
        id: pairAddress.toLowerCase(),
        amount: 24 * 7,
      };

      return isV3(externalExchange)
        ? await client.uniswapV3.request(PriceHistoryHourV3Document, variables)
        : await client.uniswapV2.request(PriceHistoryHourV2Document, variables);
    },
    {
      select: (data) => {
        const isV2 = (t: typeof data): t is PriceHistoryHourV2Query => {
          return "pair" in t;
        };

        return isV2(data)
          ? data.pair
            ? parsePriceHistoryHourV2(data)
            : undefined
          : data.pool
          ? parsePriceHistoryHourV3(data)
          : undefined;
      },
      staleTime: Infinity,
      refetchInterval: 10 * 60_000,
      enabled: !!externalExchange && !!market,
    },
  );
};

const useV2Price = (market: HookArg<Market>) => {
  const environment = useEnvironment();

  const { contractRead } = useMemo(() => {
    if (!market) return {};
    const sortedTokens = sortTokens([market.base, market.quote]);
    const pairAddress = calcV2Address(
      sortedTokens,
      environment.interface.uniswapV2.factoryAddress,
      environment.interface.uniswapV2.pairInitCodeHash,
    );
    const contractRead = getUniswapV2Read(pairAddress as Address);
    return { contractRead, sortedTokens };
  }, [
    environment.interface.uniswapV2.factoryAddress,
    environment.interface.uniswapV2.pairInitCodeHash,
    market,
  ]);

  return useContractRead({
    ...contractRead,
    staleTime: Infinity,
    enabled: !!contractRead,
    select: (data) => {
      invariant(market);
      const invert = !market.quote.sortsBefore(market.base);
      const priceFraction = new Fraction(
        data.reserve0.toString(),
        data.reserve1.toString(),
      );
      return new Price(
        market.base,
        market.quote,
        invert ? priceFraction.numerator : priceFraction.denominator,
        invert ? priceFraction.denominator : priceFraction.numerator,
      );
    },
    refetchInterval: externalRefetchInterval,
  });
};

const useV3Price = (market: HookArg<Market>) => {
  const environment = useEnvironment();

  const { contracts } = useMemo(() => {
    if (!market) return {};
    const sortedTokens = sortTokens([market.base, market.quote]);

    const contracts = objectKeys(feeTiers).map((fee) =>
      getUniswapV3Read(
        calcV3Address(
          sortedTokens,
          fee,
          environment.interface.uniswapV3.factoryAddress,
          environment.interface.uniswapV3.pairInitCodeHash,
        ) as Address,
      ),
    );
    return { contracts };
  }, [
    environment.interface.uniswapV3.factoryAddress,
    environment.interface.uniswapV3.pairInitCodeHash,
    market,
  ]);

  return useContractReads({
    contracts,
    allowFailure: true,
    staleTime: Infinity,
    enabled: !!contracts,
    select: (data) => {
      invariant(market);

      const invert = !market.quote.sortsBefore(market.base);

      return data.map((slot) => {
        if (!slot) return undefined;
        const sqrtPriceX96 = JSBI.BigInt(slot.sqrtPriceX96.toString());

        const priceFraction = new Fraction(
          JSBI.multiply(sqrtPriceX96, sqrtPriceX96),
          Q192,
        );

        return new Price(
          market.base,
          market.quote,
          invert ? priceFraction.denominator : priceFraction.numerator,
          invert ? priceFraction.numerator : priceFraction.denominator,
        );
      });
    },
    refetchInterval: externalRefetchInterval,
  });
};

export const getUniswapV2Read = (pair: Address) =>
  ({
    address: pair,
    abi: uniswapV2PairABI,
    functionName: "getReserves",
  }) as const satisfies ReadConfig<typeof uniswapV2PairABI, "getReserves">;

export const getUniswapV3Read = (pair: Address) =>
  ({
    address: pair,
    abi: uniswapV3PoolABI,
    functionName: "slot0",
  }) as const satisfies ReadConfig<typeof uniswapV3PoolABI, "slot0">;
