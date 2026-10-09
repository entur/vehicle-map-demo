import { addProtocol } from "maplibre-gl";
import {
  NIB_PROTOCOL,
  TileAddress,
  nibTileUrl,
  parseNibTileUrl,
} from "../domain/aerialImagery.ts";
import {
  NIB_TOKEN_ERROR_CODES,
  NibToken,
  NibTokenSource,
  createNibTokenSource,
  nibErrorCode,
} from "../domain/nibToken.ts";

let tokens: NibTokenSource | null = null;

/**
 * Registers the `norgeibilder://` protocol the aerial source's tiles use, with
 * the token endpoint from bootstrap.json. Called once, before the map exists,
 * so its first tile requests already find the protocol.
 */
export function registerNorgeIBilder(tokenEndpoint: string) {
  tokens = createNibTokenSource(async () => {
    const response = await fetch(tokenEndpoint);
    if (!response.ok) {
      throw new Error(`Norge i bilder token: HTTP ${response.status}`);
    }
    return (await response.json()) as NibToken;
  });

  addProtocol(NIB_PROTOCOL, async (params, abortController) => {
    const tile = parseNibTileUrl(params.url);
    if (!tile) throw new Error(`Not a Norge i bilder tile: ${params.url}`);
    const response = await fetchNibTile(tile, abortController.signal);
    return { data: await response.arrayBuffer() };
  });
}

/**
 * One tile from the tile cache, with a token. The cache refuses a stale or
 * foreign token with HTTP 200 and a JSON body, never an error status, so the
 * content type is what tells a refusal from an image; a refusal gets one retry
 * with a new token. Also used by AerialBuildingColours, which reads the
 * tiles' pixels, so both go through the same token.
 */
export async function fetchNibTile(
  tile: TileAddress,
  signal?: AbortSignal,
): Promise<Response> {
  if (!tokens) throw new Error("Norge i bilder is not registered");
  for (let attempt = 0; ; attempt++) {
    const token = await tokens.get();
    const response = await fetch(nibTileUrl(tile, token), { signal });
    if (!response.ok) {
      throw new Error(`Norge i bilder tile: HTTP ${response.status}`);
    }
    if (!response.headers.get("content-type")?.includes("json")) {
      return response;
    }
    const code = nibErrorCode(await response.json().catch(() => null));
    if (
      code !== null &&
      NIB_TOKEN_ERROR_CODES.includes(code) &&
      attempt === 0
    ) {
      tokens.invalidate(token);
      continue;
    }
    throw new Error(`Norge i bilder tile: error ${code ?? "unknown"}`);
  }
}
