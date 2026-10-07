"use client";

import {
  ArrowDown,
  ArrowUp,
  CircleAlert,
  Coins,
  Filter,
  GitBranch,
  GripVertical,
  Layers,
  Plus,
  Trash2,
} from "lucide-react";
import { useRef, useState, type DragEvent, type ReactNode } from "react";

import { AssetPickerDialog } from "@/components/assets/asset-picker-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import {
  emptyGroup,
  insertNode,
  isWithin,
  issuesForNode,
  moveNode,
  newFilter,
  newIf,
  removeNode,
  reorderNode,
  updateNode,
} from "@/lib/symphony/edit";
import type { FilterNode, GroupNode, SymphonyNode, Weighting } from "@/lib/symphony/types";
import { assetToToken } from "@/lib/assets/token-info";
import { SOL_MINT } from "@/lib/tokens";
import { cn } from "@/lib/utils";

import { ConditionBuilder } from "./condition-builder";
import { useEditor } from "./editor-context";
import { IndicatorSelect } from "./indicator-select";
import { isPositiveInt, NumberField } from "./number-field";
import { TokenChip } from "./token-chip";

/** Where a card sits, which decides its header controls. */
type Slot =
  | { kind: "root" }
  | { kind: "branch"; label: "Then" | "Else" }
  | {
      kind: "child";
      index: number;
      count: number;
      /** Set when the parent is a specified-weight group. */
      percentage?: { value: number; onChange: (value: number) => void };
    };

const TITLES: Record<SymphonyNode["type"], string> = {
  asset: "Asset",
  group: "Group",
  if: "If",
  filter: "Filter",
};

const ICONS: Record<SymphonyNode["type"], typeof Coins> = {
  asset: Coins,
  group: Layers,
  if: GitBranch,
  filter: Filter,
};

export function NodeCard({ node, path, slot }: { node: SymphonyNode; path: string; slot: Slot }) {
  const { issues, edit, setDragging } = useEditor();
  const cardRef = useRef<HTMLDivElement>(null);
  const own = issuesForNode(issues, path);
  const update = (change: (node: SymphonyNode) => SymphonyNode) =>
    edit((root) => updateNode(root, path, change));

  const onDragStart = (event: DragEvent) => {
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", path);
    if (cardRef.current) event.dataTransfer.setDragImage(cardRef.current, 16, 16);
    // Defer so the browser snapshots the card before drop zones change the layout.
    setTimeout(() => setDragging(path));
  };

  const Icon = ICONS[node.type];
  return (
    <div
      ref={cardRef}
      data-path={path}
      className={cn(
        "rounded-xl border bg-surface text-sm shadow-xs transition-[border-color,box-shadow] duration-150 hover:border-foreground/15",
        own.length > 0 &&
          "border-destructive/50 ring-3 ring-destructive/10 hover:border-destructive/60",
      )}
    >
      <div
        className={cn(
          "flex flex-wrap items-center gap-2 px-3 py-2",
          (node.type !== "asset" || own.length > 0) && "border-b",
        )}
      >
        {slot.kind !== "root" && (
          <span
            draggable
            onDragStart={onDragStart}
            onDragEnd={() => setDragging(null)}
            className="-ml-1 cursor-grab rounded p-0.5 text-muted-foreground/70 transition-colors hover:bg-muted hover:text-foreground active:cursor-grabbing"
            title="Drag to move"
            aria-hidden
          >
            <GripVertical className="size-4" />
          </span>
        )}
        <span className="inline-flex h-6 items-center gap-1 rounded-md bg-muted px-2 text-xs font-semibold text-foreground/80">
          <Icon className="size-3.5 text-muted-foreground" aria-hidden />
          {TITLES[node.type]}
        </span>
        {node.type === "asset" && (
          <TokenChip
            label="Token"
            mint={node.mint}
            onChange={(token) => update(() => ({ type: "asset", mint: token.mint }))}
          />
        )}
        {node.type === "group" && (
          <Input
            aria-label="Group name"
            value={node.name}
            onChange={(e) => update((n) => ({ ...(n as GroupNode), name: e.target.value }))}
            className="h-8 w-44 rounded-md px-2.5 text-[0.8125rem] font-medium"
          />
        )}
        <span className="flex-1" />
        {slot.kind === "child" && slot.percentage && (
          <span className="inline-flex items-center gap-1">
            <NumberField
              aria-label="Weight percent"
              value={slot.percentage.value}
              min={0}
              step="any"
              isValid={(v) => Number.isFinite(v) && v >= 0 && v <= 100}
              className="w-20"
              onCommit={slot.percentage.onChange}
            />
            <span className="type-caption">%</span>
          </span>
        )}
        {slot.kind === "child" && (
          <>
            <Button
              variant="ghost"
              size="icon-xs"
              aria-label="Move up"
              disabled={slot.index === 0}
              onClick={() => edit((root) => reorderNode(root, path, -1))}
            >
              <ArrowUp />
            </Button>
            <Button
              variant="ghost"
              size="icon-xs"
              aria-label="Move down"
              disabled={slot.index === slot.count - 1}
              onClick={() => edit((root) => reorderNode(root, path, 1))}
            >
              <ArrowDown />
            </Button>
          </>
        )}
        {slot.kind !== "root" && (
          <Button
            variant="ghost"
            size="icon-xs"
            aria-label={slot.kind === "branch" ? `Clear ${slot.label} branch` : "Remove"}
            onClick={() => edit((root) => removeNode(root, path))}
          >
            <Trash2 />
          </Button>
        )}
      </div>

      <div className={cn("space-y-3 p-3", node.type === "asset" && own.length === 0 && "hidden")}>
        {node.type === "group" && <GroupBody node={node} path={path} />}
        {node.type === "filter" && <FilterBody node={node} path={path} />}
        {node.type === "if" && (
          <>
            <ConditionBuilder
              value={node.condition}
              onChange={(condition) => update((n) => ({ ...(n as typeof node), condition }))}
            />
            <Branch label="Then">
              <NodeCard
                node={node.then}
                path={`${path}.then`}
                slot={{ kind: "branch", label: "Then" }}
              />
            </Branch>
            <Branch label="Else">
              <NodeCard
                node={node.else}
                path={`${path}.else`}
                slot={{ kind: "branch", label: "Else" }}
              />
            </Branch>
          </>
        )}
        {own.length > 0 && (
          <ul
            className="space-y-1 rounded-md bg-destructive/6 px-2.5 py-2 text-xs text-destructive"
            aria-live="polite"
          >
            {own.map((issue) => (
              <li key={issue.path + issue.message} className="flex items-start gap-1">
                <CircleAlert className="mt-px size-3.5 shrink-0" />
                {issue.message}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function Branch({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-2 border-l-2 border-border pl-4">
      <div
        className={cn(
          "inline-flex h-5 items-center rounded-full px-2 text-[0.6875rem] font-semibold tracking-wide uppercase",
          label === "Then" ? "bg-success/12 text-success" : "bg-muted text-muted-foreground",
        )}
      >
        {label}
      </div>
      {children}
    </div>
  );
}

const WEIGHT_LABELS: Record<Weighting["method"], string> = {
  equal: "Equal weight",
  specified: "Specified %",
  inverseVolatility: "Inverse volatility",
};

/** Even split to two decimals; the last child takes the rounding remainder. */
function evenPercentages(count: number): number[] {
  if (count === 0) return [];
  const base = Math.floor(10_000 / count) / 100;
  return Array.from({ length: count }, (_, i) =>
    i === count - 1 ? Math.round((100 - base * (count - 1)) * 100) / 100 : base,
  );
}

function GroupBody({ node, path }: { node: GroupNode; path: string }) {
  const { edit } = useEditor();
  const setWeight = (weight: Weighting) =>
    edit((root) => updateNode(root, path, (n) => ({ ...(n as GroupNode), weight })));
  const { weight } = node;
  const total =
    weight.method === "specified" ? weight.percentages.reduce((sum, p) => sum + p, 0) : null;

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <NativeSelect
          size="sm"
          aria-label="Weighting"
          value={weight.method}
          onChange={(e) => {
            const method = e.target.value as Weighting["method"];
            if (method === "equal") setWeight({ method });
            if (method === "specified")
              setWeight({ method, percentages: evenPercentages(node.children.length) });
            if (method === "inverseVolatility") setWeight({ method, lookbackDays: 30 });
          }}
        >
          {(Object.keys(WEIGHT_LABELS) as Weighting["method"][]).map((m) => (
            <option key={m} value={m}>
              {WEIGHT_LABELS[m]}
            </option>
          ))}
        </NativeSelect>
        {weight.method === "inverseVolatility" && (
          <span className="inline-flex items-center gap-1.5 type-caption">
            over
            <NumberField
              aria-label="Volatility lookback in days"
              value={weight.lookbackDays}
              min={1}
              step={1}
              isValid={isPositiveInt}
              className="w-16"
              onCommit={(lookbackDays) => setWeight({ method: "inverseVolatility", lookbackDays })}
            />
            days
          </span>
        )}
        {total !== null && (
          <span
            className={cn(
              "inline-flex h-6 items-center rounded-full px-2 text-xs font-medium tabular-nums",
              Math.abs(total - 100) > 1e-6
                ? "bg-destructive/10 text-destructive"
                : "bg-success/12 text-success",
            )}
          >
            Total {Math.round(total * 100) / 100}%
          </span>
        )}
      </div>
      <ChildList
        parentPath={path}
        nodes={node.children}
        percentages={weight.method === "specified" ? weight.percentages : undefined}
        onPercentage={(index, value) =>
          weight.method === "specified" &&
          setWeight({
            method: "specified",
            percentages: weight.percentages.map((p, i) => (i === index ? value : p)),
          })
        }
      />
    </>
  );
}

function FilterBody({ node, path }: { node: FilterNode; path: string }) {
  const { edit } = useEditor();
  const update = (change: Partial<FilterNode>) =>
    edit((root) => updateNode(root, path, (n) => ({ ...(n as FilterNode), ...change })));
  return (
    <>
      <div className="flex flex-wrap items-center gap-2 rounded-lg bg-surface-raised p-3">
        <span className="type-caption">Keep the</span>
        <NativeSelect
          size="sm"
          aria-label="Top or bottom"
          value={node.select.direction}
          onChange={(e) =>
            update({
              select: { ...node.select, direction: e.target.value as "top" | "bottom" },
            })
          }
        >
          <option value="top">top</option>
          <option value="bottom">bottom</option>
        </NativeSelect>
        <NumberField
          aria-label="How many to keep"
          value={node.select.count}
          min={1}
          step={1}
          isValid={isPositiveInt}
          className="w-14"
          onCommit={(count) => update({ select: { ...node.select, count } })}
        />
        <span className="type-caption">by</span>
        <IndicatorSelect
          label="Sort by"
          value={node.sortBy}
          onChange={(sortBy) => update({ sortBy })}
        />
      </div>
      <ChildList parentPath={path} nodes={node.children} />
    </>
  );
}

function ChildList({
  parentPath,
  nodes,
  percentages,
  onPercentage,
}: {
  parentPath: string;
  nodes: readonly SymphonyNode[];
  percentages?: readonly number[];
  onPercentage?: (index: number, value: number) => void;
}) {
  return (
    <div className="space-y-2 border-l border-dashed border-border pl-4">
      {nodes.map((child, index) => (
        <div key={`${parentPath}.children[${index}]`} className="space-y-2">
          <DropZone parentPath={parentPath} index={index} />
          <NodeCard
            node={child}
            path={`${parentPath}.children[${index}]`}
            slot={{
              kind: "child",
              index,
              count: nodes.length,
              percentage:
                percentages && onPercentage
                  ? { value: percentages[index] ?? 0, onChange: (v) => onPercentage(index, v) }
                  : undefined,
            }}
          />
        </div>
      ))}
      <DropZone parentPath={parentPath} index={nodes.length} empty={nodes.length === 0} />
      <AddNodeMenu parentPath={parentPath} index={nodes.length} />
    </div>
  );
}

/** A slot between children that accepts a dragged card. */
function DropZone({
  parentPath,
  index,
  empty,
}: {
  parentPath: string;
  index: number;
  empty?: boolean;
}) {
  const { dragging, setDragging, edit } = useEditor();
  const [over, setOver] = useState(false);
  const accepts = dragging !== null && !isWithin(parentPath, dragging);
  if (!accepts) {
    return empty ? (
      <p className="rounded-lg border border-dashed bg-surface-raised/50 px-3 py-4 text-center type-caption">
        Nothing here yet. Add an asset, group, condition or filter below, or drag a block in.
      </p>
    ) : null;
  }
  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        edit((root) => moveNode(root, dragging, parentPath, index));
        setDragging(null);
      }}
      className={cn(
        "flex h-8 items-center justify-center rounded-lg border border-dashed text-xs text-muted-foreground transition-colors duration-150",
        over && "border-primary bg-accent text-accent-foreground",
      )}
    >
      Drop here
    </div>
  );
}

function AddNodeMenu({ parentPath, index }: { parentPath: string; index: number }) {
  const { edit, rememberToken } = useEditor();
  const add = (node: SymphonyNode) => edit((root) => insertNode(root, parentPath, index, node));
  return (
    <div className="flex flex-wrap items-center gap-1">
      <span className="mr-1 type-caption">Add</span>
      <AssetPickerDialog
        label="Add asset"
        onSelect={(asset) => {
          rememberToken(assetToToken(asset));
          add({ type: "asset", mint: asset.mint });
        }}
        trigger={
          <Button variant="outline" size="xs" className="border-dashed">
            <Plus /> Asset
          </Button>
        }
      />
      <Button
        variant="outline"
        size="xs"
        className="border-dashed"
        onClick={() => add(emptyGroup())}
      >
        <Plus /> Group
      </Button>
      <Button
        variant="outline"
        size="xs"
        className="border-dashed"
        onClick={() => add(newIf(SOL_MINT))}
      >
        <Plus /> If
      </Button>
      <Button
        variant="outline"
        size="xs"
        className="border-dashed"
        onClick={() => add(newFilter())}
      >
        <Plus /> Filter
      </Button>
    </div>
  );
}
