// Mock OpenAI SDK
const getCompletionsResponse = (args: any) => ({
	id: "chatcmpl_test",
	object: "chat.completion",
	created: Date.now(),
	model: args?.model || "gpt-4o-mini",
	choices: [
		{
			index: 0,
			message: { role: "assistant", content: "This is a test." },
			finish_reason: "stop",
		},
	],
	usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
});

// Allow tests to override the mock behavior
let mockOverride: ((args: any) => any) | null = null;

// Track calls for test assertions
const mockCalls = {
	chatCompletions: jest.fn(),
	completions: jest.fn(),
	embeddings: jest.fn(),
};

export const setOpenAIMockResponse = (responseFn: (args: any) => any) => {
	mockOverride = responseFn;
};

export const resetOpenAIMock = () => {
	mockOverride = null;
	mockCalls.chatCompletions.mockClear();
	mockCalls.completions.mockClear();
	mockCalls.embeddings.mockClear();
};

export const getMockCalls = () => mockCalls;

// Mock APIPromise class
class MockAPIPromise extends Promise<any> {
	private parsedPromise: Promise<any> | null = null;

	// OpenAI APIPromise method for unwrapping the response
	_thenUnwrap<T>(onfulfilled?: (value: any) => T | PromiseLike<T>): Promise<T> {
		return this.then(onfulfilled);
	}

	// Method that might be used by the instrumentation
	parse(): Promise<any> {
		if (!this.parsedPromise) {
			this.parsedPromise = this.then((result) => result);
		}
		return this.parsedPromise;
	}

	// Method to handle response headers (might be needed)
	asResponse(): Promise<any> {
		return this.then((result) => ({
			data: result,
			response: { headers: {} },
		}));
	}

	// Method to handle response with headers
	withResponse(): Promise<any> {
		return this.asResponse();
	}
}

// Mock the inner Chat.Completions class
class MockChatCompletions {
	create(args: any) {
		mockCalls.chatCompletions(args);

		return new MockAPIPromise((resolve, reject) => {
			// Simulate async behavior
			setImmediate(() => {
				try {
					// If test has set a custom response, use it
					if (mockOverride) {
						const result = mockOverride(args);
						resolve(result);
						return;
					}

					if (args?.stream) {
						const chunks = [
							{
								id: "chunk1",
								choices: [
									{ index: 0, delta: { content: "Hi" }, finish_reason: null },
								],
							},
							{
								id: "chunk2",
								choices: [{ index: 0, delta: {}, finish_reason: "stop" }],
							},
						];

						const stream = {
							[Symbol.asyncIterator]: async function* () {
								for (const c of chunks) yield c;
							},
							// Add tee method for streaming
							tee: () => {
								const stream1 = {
									[Symbol.asyncIterator]: async function* () {
										for (const c of chunks) yield c;
									},
								};
								const stream2 = {
									[Symbol.asyncIterator]: async function* () {
										for (const c of chunks) yield c;
									},
								};
								return [stream1, stream2];
							},
						};

						resolve(stream);
						return;
					}

					// Default behavior: return simple response
					resolve(getCompletionsResponse(args));
				} catch (error) {
					reject(error);
				}
			});
		});
	}
}

// Mock the Completions class
class MockCompletions {
	create(args: any) {
		mockCalls.completions(args);

		return new MockAPIPromise((resolve, reject) => {
			setImmediate(() => {
				try {
					// If test has set a custom response, use it
					if (mockOverride) {
						const result = mockOverride(args);
						resolve(result);
						return;
					}

					// Default completions response
					resolve({
						id: "cmpl-test",
						object: "text_completion",
						created: Date.now(),
						model: args.model || "gpt-3.5-turbo-instruct",
						choices: [
							{
								text: "Hello, world!",
								index: 0,
								finish_reason: "stop",
							},
						],
						usage: {
							prompt_tokens: 5,
							completion_tokens: 3,
							total_tokens: 8,
						},
					});
				} catch (error) {
					reject(error);
				}
			});
		});
	}
}

// Mock the Embeddings class
class MockEmbeddings {
	create(args: any) {
		mockCalls.embeddings(args);

		return new MockAPIPromise((resolve, reject) => {
			setImmediate(() => {
				try {
					// If test has set a custom response, use it
					if (mockOverride) {
						const result = mockOverride(args);
						resolve(result);
						return;
					}

					// Default embeddings response
					resolve({
						object: "list",
						data: [
							{
								object: "embedding",
								embedding: new Array(1536).fill(0.1),
								index: 0,
							},
						],
						model: args.model || "text-embedding-ada-002",
						usage: {
							prompt_tokens: 5,
							total_tokens: 5,
						},
					});
				} catch (error) {
					reject(error);
				}
			});
		});
	}
}

// Mock Chat namespace
class MockChat {
	static Completions = MockChatCompletions;
	completions = new MockChatCompletions();
}

class MockOpenAI {
	static Chat = MockChat;
	static Completions = MockCompletions;
	static Embeddings = MockEmbeddings;
	static APIPromise = MockAPIPromise;

	APIPromise = MockAPIPromise;
	chat = new MockChat();
	completions = new MockCompletions();
	embeddings = new MockEmbeddings();
}

module.exports = {
	OpenAI: MockOpenAI,
	default: MockOpenAI,
	APIPromise: MockAPIPromise,
	setOpenAIMockResponse,
	resetOpenAIMock,
	getMockCalls,
};
module.exports.__esModule = true;
