/**
 * Basic LangGraph example.
 */
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { ChatAnthropic } from "@langchain/anthropic";
import { tool } from "@langchain/core/tools";
import { instrumentLangChain, configure, markSuccess, instrument } from "@atla-ai/insights-sdk-js";
import { diag, DiagConsoleLogger, DiagLogLevel } from "@opentelemetry/api";
diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.DEBUG);

import { z } from "zod";

const search = tool(
  async (input) => {
    const { query } = input as { query: string };
    if (
      query.toLowerCase().includes("sf") ||
      query.toLowerCase().includes("san francisco")
    ) {
      return "It's 60 degrees and foggy.";
    }
    return "It's 90 degrees and sunny.";
  },
  {
    name: "search",
    description: "Call to surf the web.",
    schema: z.object({
      query: z.string().describe("The query to use in your search."),
    }),
  }
);

const model = new ChatAnthropic({
  model: "claude-3-7-sonnet-latest",
});

const agent = createReactAgent({
  llm: model,
  tools: [search],
});

async function main() {
  configure({
    token: process.env.ATLA_INSIGHTS_TOKEN as string,
    metadata: {
      project: "langgraph-basic",
    },
  });

  instrumentLangChain();

  const instrumentedAgent = instrument("langgraph-basic")(async () => {
      const result = await agent.invoke({
      messages: [
        {
          role: "user",
          content: "what is the weather in sf",
        },
      ],
    });

    markSuccess();

    return result;
  });

  const result = instrumentedAgent();

  console.log(result);
}

main().catch(console.error);