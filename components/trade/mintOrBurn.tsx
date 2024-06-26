import ContractAddress from "../contractAddress";
import AsyncButton from "../core/asyncButton";
import CurrencyAmountSelection from "../currencyAmountSelection";
import Returns from "./returns";
import Stats from "./stats";
import { useMintAmount } from "@/hooks/useAmounts";
import { useBalance } from "@/hooks/useBalance";
import { useLendgine } from "@/hooks/useLendgine";
import { useMint } from "@/hooks/useMint";
import { Lendgine } from "@/lib/types/lendgine";
import { Market } from "@/lib/types/market";
import { Beet } from "@/utils/beet";
import tryParseCurrencyAmount from "@/utils/tryParseCurrencyAmount";
import { useMemo, useState } from "react";
import invariant from "tiny-invariant";
import { useAccount } from "wagmi";

export default function MintOrBurn({
  market,
  lendgine,
  type,
}: {
  market: Market;
  lendgine: Lendgine | undefined;
  type: "long" | "short";
}) {
  const { address } = useAccount();
  const [input, setInput] = useState("");
  const token = type === "long" ? market.base : market.quote;
  const balanceQuery = useBalance(token, address);

  const parsedAmount = useMemo(
    () => tryParseCurrencyAmount(input, token),
    [input, token],
  );

  const lendgineInfoQuery = useLendgine(lendgine);
  const mintAmounts = useMintAmount(lendgine, parsedAmount, "pmmp");
  const mint = useMint(lendgine, parsedAmount, "pmmp");

  const disableReason = useMemo(
    () =>
      input === ""
        ? "Enter an amount"
        : !parsedAmount
        ? "Invalid amount"
        : !balanceQuery.data
        ? "Loading"
        : parsedAmount.greaterThan(balanceQuery.data)
        ? "Insufficient balance"
        : mintAmounts.status !== "success" ||
          !lendgineInfoQuery.data ||
          !mint.data
        ? "Loading"
        : mintAmounts.liquidity.greaterThan(
            lendgineInfoQuery.data?.totalLiquidity,
          )
        ? "Insufficient liqudity"
        : null,
    [
      balanceQuery.data,
      input,
      lendgineInfoQuery.data,
      mint.data,
      mintAmounts.liquidity,
      mintAmounts.status,
      parsedAmount,
    ],
  );

  return (
    <div className="flex w-full flex-col gap-12 items-center">
      <div className="flex flex-col gap-2 w-full">
        <div className="rounded-xl border-2 border-gray-200 bg-white w-full">
          <CurrencyAmountSelection
            label="Input"
            type="display"
            selectedToken={token}
            value={input}
            onChange={setInput}
            amount={balanceQuery.data}
          />
        </div>
        <AsyncButton
          variant="primary"
          className="p1 h-12 w-full"
          disabled={!!disableReason}
          onClick={async () => {
            invariant(mint.data);
            await Beet(mint.data);
            setInput("");
          }}
        >
          {disableReason ?? "Trade"}
        </AsyncButton>
      </div>
      <Stats selectedLendgine={lendgine} />
      {type === "long" ? (
        <Returns market={market} long />
      ) : (
        <Returns market={market} long={false} />
      )}

      {lendgine && <ContractAddress address={lendgine.address} />}
    </div>
  );
}
