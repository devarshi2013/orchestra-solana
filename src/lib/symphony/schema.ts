import { z } from "zod";

import { base58AddressSchema } from "@/lib/jupiter/schemas";

import type {
  AssetIndicator,
  Condition,
  IndicatorSpec,
  Symphony,
  SymphonyNode,
  Weighting,
} from "./types";

/**
 * Structural shapes only (types, integer periods, address format). Rules that
 * need the whole tree or outside knowledge — weights summing to 100, empty
 * groups, unknown mints — are in validate.ts, so an editor can hold a
 * half-built tree that still parses.
 */

const periodSchema = z.number().int().positive();

export const indicatorSpecSchema: z.ZodType<IndicatorSpec> = z.discriminatedUnion("fn", [
  z.object({ fn: z.literal("price") }),
  z.object({ fn: z.literal("sma"), period: periodSchema }),
  z.object({ fn: z.literal("ema"), period: periodSchema }),
  z.object({ fn: z.literal("rsi"), period: periodSchema }),
  z.object({ fn: z.literal("cumulativeReturn"), period: periodSchema }),
  z.object({ fn: z.literal("maxDrawdown"), period: periodSchema }),
  z.object({ fn: z.literal("stdevReturn"), period: periodSchema }),
]);

export const assetIndicatorSchema: z.ZodType<AssetIndicator> = z.object({
  mint: base58AddressSchema,
  indicator: indicatorSpecSchema,
});

export const conditionSchema: z.ZodType<Condition> = z.object({
  left: assetIndicatorSchema,
  comparator: z.enum(["gt", "gte", "lt", "lte"]),
  right: z.union([z.number().finite(), assetIndicatorSchema]),
});

export const weightingSchema: z.ZodType<Weighting> = z.discriminatedUnion("method", [
  z.object({ method: z.literal("equal") }),
  z.object({
    method: z.literal("specified"),
    percentages: z.array(z.number().finite().nonnegative()),
  }),
  z.object({ method: z.literal("inverseVolatility"), lookbackDays: periodSchema }),
]);

export const symphonyNodeSchema: z.ZodType<SymphonyNode> = z.lazy(() =>
  z.discriminatedUnion("type", [
    z.object({ type: z.literal("asset"), mint: base58AddressSchema }),
    z.object({
      type: z.literal("group"),
      name: z.string(),
      weight: weightingSchema,
      children: z.array(symphonyNodeSchema),
    }),
    z.object({
      type: z.literal("if"),
      condition: conditionSchema,
      then: symphonyNodeSchema,
      else: symphonyNodeSchema,
    }),
    z.object({
      type: z.literal("filter"),
      sortBy: indicatorSpecSchema,
      select: z.object({ direction: z.enum(["top", "bottom"]), count: periodSchema }),
      children: z.array(symphonyNodeSchema),
    }),
  ]),
);

export const symphonySchema: z.ZodType<Symphony> = z.object({
  version: z.literal(1),
  name: z.string().trim().min(1),
  description: z.string().optional(),
  root: symphonyNodeSchema,
});
