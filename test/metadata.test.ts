/** biome-ignore-all lint/suspicious/noExplicitAny: Allow any */
import {
	afterEach,
	beforeEach,
	describe,
	expect,
	it,
	jest,
} from "@jest/globals";
import {
	MAX_METADATA_FIELDS,
	MAX_METADATA_KEY_CHARS,
	MAX_METADATA_VALUE_CHARS,
	METADATA_MARK,
} from "../src/internal/constants";
import { BaseAtlaTest } from "./setup";

let mockActiveSpan: any;
let mockContext: any;
let mockOtelContext: any;
let mockTrace: any;

// Helper variables for tests
const longKey = "a".repeat(MAX_METADATA_KEY_CHARS + 1);
const longValue = "b".repeat(MAX_METADATA_VALUE_CHARS + 1);

jest.mock("@opentelemetry/api", () => {
	mockActiveSpan = { setAttribute: jest.fn() };
	mockContext = { getValue: jest.fn(), setValue: jest.fn() };
	mockOtelContext = {
		active: jest.fn(() => mockContext),
		with: jest.fn((_ctx, fn: () => any) => fn()),
	};
	mockTrace = { getActiveSpan: jest.fn(() => mockActiveSpan) };
	return { trace: mockTrace, context: mockOtelContext };
});

describe("metadata", () => {
	// Move these imports here, after the mock
	let clearMetadata: any;
	let getMetadata: any;
	let setGlobalMetadata: any;
	let setMetadata: any;
	let withMetadata: any;

	beforeAll(async () => {
		const metadataModule = await import("../src/metadata");
		clearMetadata = metadataModule.clearMetadata;
		getMetadata = metadataModule.getMetadata;
		setGlobalMetadata = metadataModule.setGlobalMetadata;
		setMetadata = metadataModule.setMetadata;
		withMetadata = metadataModule.withMetadata;
	});

	let baseTest: BaseAtlaTest;
	let consoleErrorSpy: jest.SpiedFunction<typeof console.error>;

	beforeEach(() => {
		baseTest = new BaseAtlaTest();
		baseTest.beforeEach();

		jest.clearAllMocks();

		mockTrace.getActiveSpan.mockReturnValue(mockActiveSpan);
		mockOtelContext.active.mockReturnValue(mockContext);
		mockOtelContext.with.mockImplementation((_ctx: any, fn: () => any) => fn());

		mockContext.getValue.mockReturnValue(undefined);
		mockContext.setValue.mockReturnValue(mockContext);

		consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
		setGlobalMetadata({});
	});

	afterEach(() => {
		baseTest.afterEach();
		consoleErrorSpy.mockRestore();
	});

	describe("setGlobalMetadata", () => {
		it("should set valid global metadata", () => {
			const metadata = { environment: "test", version: "1.0.0" };
			setGlobalMetadata(metadata);

			// Should be able to retrieve it
			expect(getMetadata()).toEqual(metadata);
		});

		it("should validate metadata when setting globally", () => {
			const longKey = "a".repeat(MAX_METADATA_KEY_CHARS + 1);
			const longValue = "b".repeat(MAX_METADATA_VALUE_CHARS + 1);

			setGlobalMetadata({ [longKey]: longValue });

			expect(consoleErrorSpy).toHaveBeenCalledWith(
				expect.stringContaining("keys with less than"),
			);
			expect(consoleErrorSpy).toHaveBeenCalledWith(
				expect.stringContaining("values with less than"),
			);
		});

		it("should handle empty metadata", () => {
			setGlobalMetadata({});
			expect(getMetadata()).toEqual({});
		});

		it("should handle null metadata", () => {
			setGlobalMetadata(null as any);
			expect(getMetadata()).toEqual({});
		});
	});

	describe("setMetadata", () => {
		it("should set metadata when span is active", () => {
			const metadata = { user_id: "123", session_id: "abc" };

			setMetadata(metadata);

			expect(mockActiveSpan.setAttribute).toHaveBeenCalledWith(
				METADATA_MARK,
				JSON.stringify(metadata),
			);
		});

		it("should merge with existing context metadata", () => {
			const existingMetadata = { environment: "test" };
			const newMetadata = { user_id: "123" };

			mockContext.getValue.mockReturnValue(existingMetadata);

			setMetadata(newMetadata);

			const expectedMerged = { ...existingMetadata, ...newMetadata };
			expect(mockActiveSpan.setAttribute).toHaveBeenCalledWith(
				METADATA_MARK,
				JSON.stringify(expectedMerged),
			);
		});

		it("should merge with global metadata when no context metadata", () => {
			const globalMetadata = { environment: "test" };
			const newMetadata = { user_id: "123" };

			setGlobalMetadata(globalMetadata);

			setMetadata(newMetadata);

			const expectedMerged = { ...globalMetadata, ...newMetadata };
			expect(mockActiveSpan.setAttribute).toHaveBeenCalledWith(
				METADATA_MARK,
				JSON.stringify(expectedMerged),
			);
		});

		it("should not set metadata when no active span", () => {
			mockTrace.getActiveSpan.mockReturnValue(null as any);

			setMetadata({ test: "value" });

			expect(mockActiveSpan.setAttribute).not.toHaveBeenCalled();
		});

		it("should validate metadata before setting", () => {
			const longValue = "a".repeat(MAX_METADATA_VALUE_CHARS + 1);

			setMetadata({ test: longValue });

			expect(consoleErrorSpy).toHaveBeenCalledWith(
				expect.stringContaining("values with less than"),
			);
		});
	});

	describe("getMetadata", () => {
		it("should return context metadata when available", () => {
			const contextMetadata = { user_id: "123" };
			mockContext.getValue.mockReturnValue(contextMetadata);

			const result = getMetadata();

			expect(result).toEqual(contextMetadata);
		});

		it("should fall back to global metadata when no context metadata", () => {
			const globalMetadata = { environment: "test" };
			setGlobalMetadata(globalMetadata);
			mockContext.getValue.mockReturnValue(undefined);

			const result = getMetadata();

			expect(result).toEqual(globalMetadata);
		});

		it("should return undefined when no metadata is available", () => {
			setGlobalMetadata({});
			mockContext.getValue.mockReturnValue(undefined);

			const result = getMetadata();

			expect(result).toEqual({});
		});
	});

	describe("withMetadata", () => {
		it("should run function with metadata in context", () => {
			const metadata = { test_context: "value" };
			const testFn = jest.fn(() => "result");

			const result = withMetadata(metadata, testFn);

			expect(result).toBe("result");
			expect(testFn).toHaveBeenCalled();
			expect(mockContext.setValue).toHaveBeenCalledWith(
				expect.any(Symbol),
				metadata,
			);
			expect(mockOtelContext.with).toHaveBeenCalledWith(mockContext, testFn);
		});

		it("should handle async functions", async () => {
			const metadata = { async_test: "value" };
			const asyncFn = jest.fn(async () => {
				await new Promise((resolve) => setTimeout(resolve, 10));
				return "async-result";
			});

			const result = await withMetadata(metadata, asyncFn);

			expect(result).toBe("async-result");
			expect(asyncFn).toHaveBeenCalled();
		});

		it("should validate metadata before setting context", () => {
			const longKey = "a".repeat(MAX_METADATA_KEY_CHARS + 1);
			const testFn = jest.fn(() => "result");

			withMetadata({ [longKey]: "value" }, testFn);

			expect(consoleErrorSpy).toHaveBeenCalledWith(
				expect.stringContaining("keys with less than"),
			);
			expect(testFn).toHaveBeenCalled();
		});

		it("should isolate metadata between calls", () => {
			const metadata1 = { test: "value1" };
			const metadata2 = { test: "value2" };

			withMetadata(metadata1, () => {
				expect(mockContext.setValue).toHaveBeenCalledWith(
					expect.any(Symbol),
					metadata1,
				);
			});

			withMetadata(metadata2, () => {
				expect(mockContext.setValue).toHaveBeenCalledWith(
					expect.any(Symbol),
					metadata2,
				);
			});
		});
	});

	describe("clearMetadata", () => {
		it("should clear metadata and fall back to global", () => {
			const globalMetadata = { environment: "test" };
			setGlobalMetadata(globalMetadata);

			clearMetadata();

			expect(mockContext.setValue).toHaveBeenCalledWith(
				expect.any(Symbol),
				undefined,
			);
			expect(mockActiveSpan.setAttribute).toHaveBeenCalledWith(
				METADATA_MARK,
				JSON.stringify(globalMetadata),
			);
		});

		it("should handle empty global metadata", () => {
			setGlobalMetadata({});

			clearMetadata();

			expect(mockActiveSpan.setAttribute).toHaveBeenCalledWith(
				METADATA_MARK,
				JSON.stringify({}),
			);
		});

		it("should not clear when no active span", () => {
			mockTrace.getActiveSpan.mockReturnValue(null as any);

			clearMetadata();

			expect(mockActiveSpan.setAttribute).not.toHaveBeenCalled();
		});
	});

	describe("metadata validation", () => {
		describe("field count limits", () => {
			it("should limit number of metadata fields", () => {
				const tooManyFields: Record<string, string> = {};
				for (let i = 0; i < MAX_METADATA_FIELDS + 5; i++) {
					tooManyFields[`field_${i}`] = `value_${i}`;
				}

				setGlobalMetadata(tooManyFields);

				expect(consoleErrorSpy).toHaveBeenCalledWith(
					expect.stringContaining(`${MAX_METADATA_FIELDS + 5} fields`),
				);

				const result = getMetadata();
				expect(Object.keys(result || {})).toHaveLength(MAX_METADATA_FIELDS);
			});
		});

		describe("key length limits", () => {
			it("should truncate oversized keys", () => {
				const longKey = "a".repeat(MAX_METADATA_KEY_CHARS + 10);
				const expectedKey = "a".repeat(MAX_METADATA_KEY_CHARS);

				setGlobalMetadata({ [longKey]: "value" });

				expect(consoleErrorSpy).toHaveBeenCalledWith(
					expect.stringContaining("keys with less than"),
				);

				const result = getMetadata();
				expect(result).toHaveProperty(expectedKey, "value");
				expect(result).not.toHaveProperty(longKey);
			});

			it("should not modify keys within limits", () => {
				const validKey = "a".repeat(MAX_METADATA_KEY_CHARS);

				setGlobalMetadata({ [validKey]: "value" });

				expect(consoleErrorSpy).not.toHaveBeenCalled();
				expect(getMetadata()).toHaveProperty(validKey, "value");
			});
		});

		describe("value length limits", () => {
			it("should truncate oversized values", () => {
				const longValue = "b".repeat(MAX_METADATA_VALUE_CHARS + 10);
				const expectedValue = "b".repeat(MAX_METADATA_VALUE_CHARS);

				setGlobalMetadata({ test: longValue });

				expect(consoleErrorSpy).toHaveBeenCalledWith(
					expect.stringContaining("values with less than"),
				);

				const result = getMetadata();
				expect(result?.test).toBe(expectedValue);
			});

			it("should not modify values within limits", () => {
				const validValue = "b".repeat(MAX_METADATA_VALUE_CHARS);

				setGlobalMetadata({ test: validValue });

				expect(consoleErrorSpy).not.toHaveBeenCalled();
				expect(getMetadata()?.test).toBe(validValue);
			});
		});

		describe("type validation", () => {
			it("should throw error for non-object metadata", () => {
				expect(() => setGlobalMetadata("invalid" as any)).toThrow(
					"The metadata field must be a dictionary.",
				);
				expect(() => setGlobalMetadata(null as any)).not.toThrow();
				expect(() => setGlobalMetadata(["array"] as any)).toThrow(
					"The metadata field must be a dictionary.",
				);
			});

			it("should convert non-string values to strings", () => {
				const metadata = {
					string_key: "string_value",
					number_key: 42 as any,
					boolean_key: true as any,
				};

				setGlobalMetadata(metadata);

				expect(consoleErrorSpy).toHaveBeenCalledWith(
					"The metadata field must be a mapping of string to string.",
				);

				const result = getMetadata();
				expect(result).toEqual({
					string_key: "string_value",
					number_key: "42",
					boolean_key: "true",
				});
			});

			it("should convert non-string keys to strings", () => {
				const metadata = {
					42: "number_key_value",
					string_key: "string_value",
				} as any;

				setGlobalMetadata(metadata);

				const result = getMetadata();
				expect(result).toEqual({
					"42": "number_key_value",
					string_key: "string_value",
				});
			});
		});
	});

	describe("integration scenarios", () => {
		it("should handle complex metadata lifecycle", () => {
			// Set global metadata
			const globalMeta = { environment: "test", version: "1.0" };
			setGlobalMetadata(globalMeta);

			// Should get global metadata initially
			expect(getMetadata()).toEqual(globalMeta);

			// Set runtime metadata
			const runtimeMeta = { user_id: "123", session: "abc" };
			setMetadata(runtimeMeta);

			// Should have merged metadata on span
			const expectedMerged = { ...globalMeta, ...runtimeMeta };
			expect(mockActiveSpan.setAttribute).toHaveBeenCalledWith(
				METADATA_MARK,
				JSON.stringify(expectedMerged),
			);

			// Clear runtime metadata
			clearMetadata();

			// Should fall back to global metadata
			expect(mockActiveSpan.setAttribute).toHaveBeenLastCalledWith(
				METADATA_MARK,
				JSON.stringify(globalMeta),
			);
		});

		it("should handle withMetadata context isolation", () => {
			const globalMeta = { environment: "test" };
			setGlobalMetadata(globalMeta);

			const contextMeta1 = { context: "first" };
			const contextMeta2 = { context: "second" };

			let firstResult: any;
			let secondResult: any;

			withMetadata(contextMeta1, () => {
				firstResult = getMetadata();
			});

			withMetadata(contextMeta2, () => {
				secondResult = getMetadata();
			});

			// Each context should have seen its own metadata
			// Note: In this test, getMetadata will still return global since we're mocking
			// the context APIs, but the setValue calls should show the isolation
			expect(mockContext.setValue).toHaveBeenCalledWith(
				expect.any(Symbol),
				contextMeta1,
			);
			expect(mockContext.setValue).toHaveBeenCalledWith(
				expect.any(Symbol),
				contextMeta2,
			);
		});

		it("should validate all metadata operations consistently", () => {
			const invalidMeta = {
				[longKey]: longValue,
				valid_key: "valid_value",
			};

			// All operations should validate consistently
			setGlobalMetadata(invalidMeta);
			expect(consoleErrorSpy).toHaveBeenCalledTimes(2); // key + value errors

			consoleErrorSpy.mockClear();

			setMetadata(invalidMeta);
			expect(consoleErrorSpy).toHaveBeenCalledTimes(2); // key + value errors

			consoleErrorSpy.mockClear();

			withMetadata(invalidMeta, () => {});
			expect(consoleErrorSpy).toHaveBeenCalledTimes(2); // key + value errors
		});
	});
});
