import type { Protocol } from "../constants";
import { useEnvironment } from "../contexts/environment";
import type { Lendgine } from "../lib/types/lendgine";
import type { HookArg } from "./internal/types";
import { useQueryFactory } from "./internal/useQueryFactory";
import { userRefectchInterval } from "./internal/utils";
import { useQueries } from "@tanstack/react-query";
import { Address } from "wagmi";

export const useLendginesPositions = <L extends Lendgine>(
  lendgines: HookArg<readonly L[]>,
  address: HookArg<Address>,
  protocol: Protocol,
) => {
  const queries = useQueryFactory();

  const environment = useEnvironment();
  const protocolConfig = environment.procotol[protocol]!;

  return useQueries({
    queries: lendgines
      ? lendgines.map((l) => ({
          ...queries.reverseMirage.liquidityManagerPosition({
            lendgine: l,
            address,
            liquidityManagerAddress: protocolConfig.liquidityManager,
          }),
          refetchInterval: userRefectchInterval,
        }))
      : [],
  });
};
