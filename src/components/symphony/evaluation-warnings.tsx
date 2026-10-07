import { TriangleAlert } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

/** Lists nodes that fell back because a token's price history is too short. */
export function EvaluationWarnings({ messages }: { messages: readonly string[] }) {
  if (messages.length === 0) return null;
  return (
    <Alert variant="warning">
      <TriangleAlert />
      <AlertTitle>Not enough price history</AlertTitle>
      <AlertDescription>
        <ul className="list-disc space-y-1 pl-4">
          {messages.map((message) => (
            <li key={message}>{message}</li>
          ))}
        </ul>
      </AlertDescription>
    </Alert>
  );
}
