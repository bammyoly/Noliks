import React, { createContext, useContext, useEffect, useState } from "react";

const FheContext = createContext(null);
const FALLBACK = {
  encryptSafe: async (s) => String(s ?? ""),
  prove: async () => new Uint8Array(0),
};

export const FheProvider = ({ children }) => {
  const [fhe, setFhe] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        if (typeof window === "undefined") throw new Error("no window");
        if (!window.ethereum) throw new Error("no wallet");
        if (!globalThis.global) globalThis.global = globalThis; // fix 'global' ref

        const sdkUrl = "https://cdn.zama.ai/relayer-sdk-js/0.2.0/relayer-sdk-js.js";
        const mod = await import(/* @vite-ignore */ sdkUrl).catch(() => ({}));
        const maybe = mod?.default || mod || {};
        const sdk = Object.keys(maybe).length
          ? maybe
          : (globalThis.zamaRelayerSDK || globalThis.RelayerSDK || globalThis.ZamaRelayerSDK || {});

        const { initSDK, createInstance, SepoliaConfig } = sdk || {};
        if (!initSDK || !createInstance || !SepoliaConfig) throw new Error("Relayer SDK missing");

        const race = (p, ms) =>
          Promise.race([p, new Promise((_, r) => setTimeout(() => r(new Error("timeout")), ms))]);

        await race(initSDK(), 8000);

        const apiKey =
          import.meta.env?.VITE_ZAMA_API_KEY ||
          import.meta.env?.VITE_FHE_API_KEY ||
          "public_test_key";

        const instance = await race(
          createInstance({ ...SepoliaConfig, apiKey, network: window.ethereum }),
          12000
        );

        const find = (names) => {
          const seen = new Set();
          const q = [{ o: instance, b: instance, d: 0 }];
          const norm = (s) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
          const want = names.map(norm);
          while (q.length) {
            const { o, b, d } = q.shift();
            if (!o || typeof o !== "object" || seen.has(o) || d > 3) continue;
            seen.add(o);
            for (const k of Object.keys(o)) {
              const v = o[k];
              if (typeof v === "function") {
                const nk = norm(k);
                if (want.some((w) => nk.includes(w))) return v.bind(b);
              }
              if (v && typeof v === "object") q.push({ o: v, b: v, d: d + 1 });
            }
          }
          return null;
        };

        const encrypt_uint64  = find(["encrypt_uint64","encryptU64","uint64","u64"]);
        const encrypt_uint256 = find(["encrypt_uint256","encryptU256","uint256","u256"]);
        const encrypt_bool    = find(["encrypt_bool","encryptBoolean","ebool"]);
        const prove           = find(["prove","generate_proof","genProof"]);

        const encryptSafe = async (s) => {
          const str = String(s ?? "");
          if (typeof instance.encryptString === "function") return instance.encryptString(str);
          const bytes = new TextEncoder().encode(str);
          if (typeof instance.encrypt_bytes === "function") return instance.encrypt_bytes(bytes);
          if (typeof instance.encryptBytes === "function") return instance.encryptBytes(bytes);
          return str;
        };

        const encryptUint256Auto = async (v) => {
          if (!encrypt_uint256) throw new Error("encrypt_uint256 missing");
          if (typeof v === "bigint") return encrypt_uint256(v);
          if (typeof v === "string" && v.startsWith("0x")) return encrypt_uint256(BigInt(v));
          return encrypt_uint256(BigInt(String(v)));
        };

        const ready = !!(encrypt_uint64 && encrypt_uint256 && encrypt_bool && prove);
        console.log("FHE SDK ready:", ready);

        if (!cancelled) {
          setFhe(
            ready
              ? { raw: instance, encrypt_uint64, encrypt_uint256, encryptUint256Auto, encrypt_bool, prove, encryptSafe }
              : { ...FALLBACK } 
          );
        }
      } catch (e) {
        console.warn("FHE init failed → using mock path", e);
        if (!cancelled) setFhe(FALLBACK);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, []);

  return (
    <FheContext.Provider value={{ fhe, loading }}>
      {children}
    </FheContext.Provider>
  );
};

export const useFhe = () => useContext(FheContext);
