import { errorResponse } from "@/server/http";
import { getRegistry } from "@/server/assets/registry";

/** GET → the verified investable-asset registry (stocks and crypto). */
export async function GET() {
  try {
    const { builtAt, stocks, crypto } = await getRegistry();
    return Response.json({ builtAt, stocks, crypto });
  } catch (error) {
    console.error("[assets] unavailable", error);
    return errorResponse(
      503,
      "The asset registry is still loading or Jupiter is unreachable; try again shortly",
    );
  }
}
