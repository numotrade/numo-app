import { formatDisplayWithSoftLimit } from "@/utils/format";
import type { CurrencyAmount, Token } from "@uniswap/sdk-core";
import { clsx } from "clsx";

export default function TokenAmountDisplay({
  amount,
  showSymbol,
  className,
}: {
  amount: CurrencyAmount<Token>;
  showSymbol: boolean;
  className?: string;
}) {
  return (
    <div className={clsx("flex items-center", className)}>
      {amount.equalTo(0)
        ? "0"
        : formatDisplayWithSoftLimit(Number(amount.toFixed(6)), 4, 10)}
      {showSymbol && (
        <span>
          {"\u00A0"}
          {amount.currency.symbol}
        </span>
      )}
    </div>
  );
}
