import type { ImgHTMLAttributes } from "react";

type Props = ImgHTMLAttributes<HTMLImageElement> & {
  eager?: boolean;
};

/** Fast image load without changing pixels: async decode + lazy by default. */
export default function SmartImage({
  eager = false,
  loading,
  decoding,
  fetchPriority,
  alt = "",
  ...rest
}: Props) {
  return (
    <img
      alt={alt}
      loading={eager ? "eager" : loading ?? "lazy"}
      decoding={decoding ?? "async"}
      fetchPriority={eager ? "high" : fetchPriority}
      {...rest}
    />
  );
}
