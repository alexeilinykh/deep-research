import {
  streamText,
  type Message,
  type TelemetrySettings,
  type StreamTextResult,
} from "ai";
import { model } from "~/model";
import { runAgentLoop } from "./run-agent-loop";
import type { OurMessageAnnotation } from "./get-next-action";

export async function streamFromDeepSearch(opts: {
  messages: Message[];
  onFinish: Parameters<typeof streamText>[0]["onFinish"];
  telemetry: TelemetrySettings;
  writeMessageAnnotation?: (annotation: OurMessageAnnotation) => void;
}): Promise<StreamTextResult<{}, string>> {
  // Extract the user's question from the messages
  const userQuestion = opts.messages[opts.messages.length - 1]?.content || "";

  // Extract langfuseTraceId from telemetry metadata if available
  const langfuseTraceId = opts.telemetry.metadata?.langfuseTraceId as
    | string
    | undefined;

  // Run the agent loop and wait for the result
  return await runAgentLoop(userQuestion, {
    writeMessageAnnotation: opts.writeMessageAnnotation,
    langfuseTraceId,
  });
}

export async function askDeepSearch(messages: Message[]) {
  const result = await streamFromDeepSearch({
    messages,
    onFinish: () => {}, // just a stub
    telemetry: {
      isEnabled: false,
    },
  });

  // Consume the stream - without this,
  // the stream will never finish
  await result.consumeStream();

  return await result.text;
}
