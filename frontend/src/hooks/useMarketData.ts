import { useEffect, useState } from "react";
import { fetchAssets, fetchPrices, type Asset, type PricePoint } from "../lib/api";

export function useMarketData(symbol: string, compare: string, limit: number) {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [dataPrimary, setDataPrimary] = useState<PricePoint[]>([]);
  const [dataCompare, setDataCompare] = useState<PricePoint[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    fetchAssets().then(setAssets).catch((e) => setErr(String(e)));
  }, []);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setErr(null);
      try {
        const p = await fetchPrices(symbol, limit);
        setDataPrimary([...p].sort((a, b) => +new Date(a.t) - +new Date(b.t)));

        if (compare) {
          const c = await fetchPrices(compare, limit);
          setDataCompare([...c].sort((a, b) => +new Date(a.t) - +new Date(b.t)));
        } else {
          setDataCompare([]);
        }
      } catch (e) {
        setErr(String(e));
      } finally {
        setLoading(false);
      }
    };

    load();
    const id = setInterval(load, 60000);
    return () => clearInterval(id);
  }, [symbol, compare, limit]);

  return { assets, dataPrimary, dataCompare, loading, err };
}
