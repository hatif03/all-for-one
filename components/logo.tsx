"use client";

import Image from "next/image";

export default function Logo({ className }: { className?: string }) {
  return (
    <Image
      src="/all-might.png"
      alt="One for All"
      width={48}
      height={48}
      className={`shrink-0 object-contain ${className ?? ""}`}
    />
  );
}
