import {
  streamText,
  type Message,
  type TelemetrySettings,
  type StreamTextResult,
} from "ai";
import { model } from "~/model";
import { runAgentLoop } from "./run-agent-loop";

export async function streamFromDeepSearch(opts: {
  messages: Message[];
  onFinish: Parameters<typeof streamText>[0]["onFinish"];
  telemetry: TelemetrySettings;
}): Promise<StreamTextResult<{}, string>> {
  // Extract the user's question from the messages
  const userQuestion = opts.messages[opts.messages.length - 1]?.content || "";

  // Run the agent loop and wait for the result
  return await runAgentLoop(userQuestion);
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
