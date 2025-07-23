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
  locationHints?: {
    latitude?: string;
    longitude?: string;
    city?: string;
    country?: string;
  };
}): Promise<StreamTextResult<{}, string>> {
  // Extract langfuseTraceId from telemetry metadata if available
  const langfuseTraceId = opts.telemetry.metadata?.langfuseTraceId as
    | string
    | undefined;

  // Run the agent loop and wait for the result
  return await runAgentLoop(opts.messages, {
    writeMessageAnnotation: opts.writeMessageAnnotation,
    langfuseTraceId,
    onFinish: opts.onFinish,
    locationHints: opts.locationHints,
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
