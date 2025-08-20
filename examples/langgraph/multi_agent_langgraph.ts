/**
 * Multi-agent LangGraph example.
 * 
 * See - https://langchain-ai.github.io/langgraphjs/how-tos/multi-agent-network/#travel-recommendations-example
 */
import { diag, DiagConsoleLogger, DiagLogLevel } from "@opentelemetry/api";
diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.DEBUG);

import { configure, instrument, instrumentLangChain } from "@atla-ai/insights-sdk-js";
import { ChatOpenAI } from "@langchain/openai";
import {
  Command,
  MessagesAnnotation,
  StateGraph
} from "@langchain/langgraph";

import { z } from "zod";

const model = new ChatOpenAI({
  model: "gpt-4o",
  temperature: 0.1,
});

const makeAgentNode = (params: {
  name: string,
  destinations: string[],
  systemPrompt: string
}) => {
  return async (state: typeof MessagesAnnotation.State) => {
    const possibleDestinations = ["__end__", ...params.destinations] as const;
    // define schema for the structured output:
    // - model's text response (`response`)
    // - name of the node to go to next (or '__end__')
    const responseSchema = z.object({
      response: z.string().describe(
        "A human readable response to the original question. Does not need to be a final response. Will be streamed back to the user."
      ),
      goto: z.enum(possibleDestinations).describe("The next agent to call, or __end__ if the user's query has been resolved. Must be one of the specified values."),
    });
    const messages = [
      {
        role: "system",
        content: params.systemPrompt
      },
      ...state.messages,
    ];
    const response = await model.withStructuredOutput(responseSchema, {
      name: "router",
    }).invoke(messages);

    // handoff to another agent or halt
    const aiMessage = {
      role: "assistant",
      content: response.response,
      name: params.name,
    };
    return new Command({
      goto: response.goto,
      update: { messages: aiMessage }
    });
  }
};

const travelAdvisor = makeAgentNode({
  name: "travel_advisor",
  destinations: ["sightseeing_advisor", "hotel_advisor"],
  systemPrompt: [
    "You are a general travel expert that can recommend travel destinations (e.g. countries, cities, etc). ",
    "If you need specific sightseeing recommendations, ask 'sightseeing_advisor' for help. ",
    "If you need hotel recommendations, ask 'hotel_advisor' for help. ",
    "If you have enough information to respond to the user, return '__end__'. ",
    "Never mention other agents by name."
  ].join(""),
});

const sightseeingAdvisor = makeAgentNode({
  name: "sightseeing_advisor",
  destinations: ["travel_advisor", "hotel_advisor"],
  systemPrompt: [
    "You are a travel expert that can provide specific sightseeing recommendations for a given destination. ",
    "If you need general travel help, go to 'travel_advisor' for help. ",
    "If you need hotel recommendations, go to 'hotel_advisor' for help. ",
    "If you have enough information to respond to the user, return 'finish'. ",
    "Never mention other agents by name."
  ].join(""),
});

const hotelAdvisor = makeAgentNode({
  name: "hotel_advisor",
  destinations: ["travel_advisor", "sightseeing_advisor"],
  systemPrompt: [
    "You are a booking expert that provides hotel recommendations for a given destination. ",
    "If you need general travel help, ask 'travel_advisor' for help. ",
    "If you need specific sightseeing recommendations, ask 'sightseeing_advisor' for help. ",
    "If you have enough information to respond to the user, return 'finish'. ",
    "Never mention other agents by name.",
  ].join(""),
});

const graph = new StateGraph(MessagesAnnotation)
  .addNode("travel_advisor", travelAdvisor, {
    ends: ["sightseeing_advisor", "hotel_advisor", "__end__"],
  })
  .addNode("sightseeing_advisor", sightseeingAdvisor, {
    ends: ["travel_advisor", "hotel_advisor", "__end__"],
  })
  .addNode("hotel_advisor", hotelAdvisor, {
    ends: ["travel_advisor", "sightseeing_advisor", "__end__"],
  })
  // we'll always start with a general travel advisor
  .addEdge("__start__", "travel_advisor")
  .compile();

async function main() {
  configure({
    token: process.env.ATLA_INSIGHTS_TOKEN as string,
    metadata: {
      project: "langgraph-multi-agent",
    },
  });

  instrumentLangChain();

  const instrumentedGraph = instrument("langgraph-multi-agent")(async () => {
    const simpleStream = await graph.stream({
      messages: [{
        role: "user",
        content: "i wanna go somewhere warm in the caribbean. pick one destination, give me some things to do and hotel recommendations",
      }],
    });

    for await (const chunk of simpleStream) {
      console.log(chunk);
    }
  });

  instrumentedGraph();
}

main().catch(console.error);