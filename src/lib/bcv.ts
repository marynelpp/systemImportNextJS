import "server-only";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { parseBcvUsdRate } from "./bcv-parser";

export const BCV_RATE_URL = "https://www.bcv.org.ve/";
const run = promisify(execFile);

async function fetchWithWindowsCertificateStore() {
  // The BCV server currently omits part of its certificate chain. Windows
  // Schannel completes that chain from the OS store; curl.exe uses Schannel.
  // Do not add --insecure/-k: certificate validation must remain enabled.
  const { stdout } = await run(
    "curl.exe",
    [
      "--fail",
      "--silent",
      "--show-error",
      "--max-time",
      "15",
      "--proto",
      "=https",
      "--tlsv1.2",
      BCV_RATE_URL,
    ],
    { windowsHide: true, maxBuffer: 2 * 1024 * 1024 },
  );
  return stdout;
}

export async function fetchBcvUsdRate() {
  try {
    const response = await fetch(BCV_RATE_URL, {
      cache: "no-store",
      headers: {
        Accept: "text/html",
        "User-Agent": "Nexo-Import/1.0 (official-rate-sync)",
      },
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) throw new Error(`El BCV respondió con ${response.status}.`);
    return parseBcvUsdRate(await response.text());
  } catch (error) {
    const code = (error as { cause?: { code?: string } }).cause?.code;
    if (process.platform !== "win32" || code !== "UNABLE_TO_VERIFY_LEAF_SIGNATURE") throw error;
    return parseBcvUsdRate(await fetchWithWindowsCertificateStore());
  }
}
