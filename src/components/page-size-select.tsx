"use client";

import { useRouter } from "next/navigation";

export default function PageSizeSelect({ basePath, query, limit }: { basePath: string; query: string; limit: number }) {
  const router = useRouter();
  return <label className="page-size-select">Registros por página<select value={limit} onChange={(event) => {
    const next = new URLSearchParams({ ...(query ? { q: query } : {}), limit: event.target.value, page: "1" });
    router.push(`${basePath}?${next.toString()}`);
  }}><option value="5">5</option><option value="10">10</option><option value="20">20</option></select></label>;
}
