import { Agent, run } from "@openai/agents";
import { configure, instrument, instrumentOpenAIAgents } from "@atla-ai/insights-sdk-js"; 

configure({
  token: process.env.ATLA_INSIGHTS_TOKEN as string,
  metadata: {
    project: "my-project",
    environment: "development",
    version: "1.0.0",
    user: "john_doe",
  },
});

instrumentOpenAIAgents();

const agent = new Agent({
  name: 'Assistant',
  instructions: 'You are a helpful assistant.',
});

async function main(): Promise<void> {
  const myInstrumentedFunction = instrument("My instrumented function")(
    async () => {
      const result = await run(
        agent,
        "Write a haiku about recursion in programming.",
      );
      return result.finalOutput;
    },
  );

  const result = await myInstrumentedFunction();
  console.log(result);
}

main().catch(console.error);