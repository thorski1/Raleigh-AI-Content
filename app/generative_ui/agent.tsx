import "server-only";

import { ChatMessage } from "@langchain/core/messages";
import { agentExecutor } from "./ai/chain";
import { exposeEndpoints, streamRunnableUI } from "./utils/server";

async function agent(inputs: {
  input: string;
  chat_history: [role: string, content: string][];
}) {
  "use server";

  return streamRunnableUI(agentExecutor, {
    input: inputs.input,
    chat_history: inputs.chat_history.map(
      ([role, content]) => new ChatMessage(content, role),
    ),
  });
}

export const EndpointsContext = exposeEndpoints({ agent });
