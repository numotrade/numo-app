import type { WrappedTokenInfo } from "@/lib/types/wrappedTokenInfo";
import Image from "next/image";

export default function TokenIcon({
  tokenInfo,
  size,
}: {
  tokenInfo: WrappedTokenInfo;
  size: number;
}) {
  return tokenInfo.logoURI ? (
    <Image
      className="flex overflow-hidden rounded-[50%]"
      height={size}
      width={size}
      src={tokenInfo.logoURI}
      alt="token icon"
    />
  ) : (
    <div className="border-1 flex overflow-hidden rounded-[100%] border-dashed border-gray-200" />
  );
}
