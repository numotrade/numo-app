import { liquidityManagerABI } from "../abis/liquidityManager";
import type { Protocol } from "../constants";
import { useEnvironment } from "../contexts/environment";
import type { Lendgine, LendginePosition } from "../lib/types/lendgine";
import type { WrappedTokenInfo } from "../lib/types/wrappedTokenInfo";
import { toaster } from "../pages/_app";
import type { BeetStage, TxToast } from "../utils/beet";
import type { HookArg } from "./internal/types";
import { useInvalidateCall } from "./internal/useInvalidateCall";
import { useCollectAmount } from "./useAmounts";
import { useIsWrappedNative } from "./useTokens";
import { AddressZero } from "@/lib/constants";
import { position as positionRead } from "@/lib/reverseMirage/liquidityManager";
import { balanceOf } from "@/lib/reverseMirage/token";
import { useMutation } from "@tanstack/react-query";
import type { CurrencyAmount } from "@uniswap/sdk-core";
import { useMemo } from "react";
import { encodeFunctionData } from "viem";
import type { Address } from "wagmi";
import { useAccount } from "wagmi";
import {
  prepareWriteContract,
  waitForTransaction,
  writeContract,
} from "wagmi/actions";

export const useCollect = <L extends Lendgine>(
  lendgine: HookArg<L>,
  position: HookArg<LendginePosition<L>>,
  protocol: Protocol,
) => {
  const environment = useEnvironment();
  const protocolConfig = environment.procotol[protocol]!;
  const { address } = useAccount();

  const invalidate = useInvalidateCall();

  const native = useIsWrappedNative(lendgine?.token1);
  const title = "Collect interest";

  const collectAmount = useCollectAmount(lendgine, position, protocol);

  const mutate = useMutation({
    mutationFn: async ({
      lendgine,
      address,
      tokensOwed,
      toast,
    }: {
      lendgine: Lendgine;
      tokensOwed: CurrencyAmount<WrappedTokenInfo>;
      address: Address;
    } & {
      toast: TxToast;
    }) => {
      const args = [
        {
          lendgine: lendgine.address,
          recipient: native ? AddressZero : address,
          amountRequested: BigInt(tokensOwed.quotient.toString()),
        },
      ] as const;

      const unwrapArgs = [BigInt(0), address] as const; // safe to be zero because the collect estimation will fail

      const tx = native
        ? async () => {
            const config = await prepareWriteContract({
              abi: liquidityManagerABI,
              address: protocolConfig.liquidityManager,
              functionName: "multicall",
              value: BigInt(0),
              args: [
                [
                  encodeFunctionData({
                    abi: liquidityManagerABI,
                    functionName: "collect",
                    args,
                  }),
                  encodeFunctionData({
                    abi: liquidityManagerABI,
                    args: unwrapArgs,
                    functionName: "unwrapWETH",
                  }),
                ],
              ],
            });
            return await writeContract(config.request);
          }
        : async () => {
            const config = await prepareWriteContract({
              abi: liquidityManagerABI,
              address: protocolConfig.liquidityManager,
              functionName: "collect",
              args,
              value: BigInt(0),
            });
            return await writeContract(config.request);
          };

      const transaction = await tx();

      toaster.txPending({ ...toast, hash: transaction.hash });

      return await waitForTransaction(transaction);
    },
    onMutate: ({ toast }) => toaster.txSending(toast),
    onError: (_, { toast }) => toaster.txError(toast),
    onSuccess: async (data, input) => {
      toaster.txSuccess({ ...input.toast, receipt: data });
      lendgine &&
        (await Promise.all([
          invalidate(positionRead, {
            lendgine: lendgine,
            address: input.address,
            liquidityManagerAddress: protocolConfig.liquidityManager,
          }),
          invalidate(balanceOf, {
            token: lendgine.token1,
            address: input.address,
          }),
        ]));
    },
  });

  return useMemo(() => {
    if (collectAmount.status === "loading")
      return { status: "loading" } as const;
    if (!address || !lendgine || collectAmount.status !== "success")
      return { status: "error" } as const;

    return {
      status: "success",
      data: [
        {
          title,
          parallelTxs: [
            {
              title,
              description: title,
              callback: (toast: TxToast) =>
                mutate.mutateAsync({
                  lendgine,
                  tokensOwed: collectAmount.tokensOwed,
                  address: address,
                  toast,
                }),
            },
          ],
        },
      ],
    } as const satisfies { data: readonly BeetStage[]; status: "success" };
  }, [
    address,
    collectAmount.status,
    collectAmount.tokensOwed,
    lendgine,
    mutate,
  ]);
};
