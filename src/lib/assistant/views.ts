/** One tool call and its result, as shown in a "data used" panel. */
export type ToolCallView = {
  id: string;
  name: string;
  input: unknown;
  /** The tool result as the model saw it (addresses redacted, long results cut). */
  result: string | null;
  ok: boolean | null;
};
