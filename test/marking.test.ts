import {
	afterEach,
	beforeEach,
	describe,
	expect,
	it,
	jest,
} from "@jest/globals";
import { SUCCESS_MARK } from "../src/internal/constants";
import { BaseAtlaTest } from "./setup";

const mockRootSpan = {
	setAttribute: jest.fn(),
};

jest.mock("../src/context", () => ({
	getAtlaContext: jest.fn(),
}));

import { getAtlaContext } from "../src/context";
import { markFailure, markSuccess } from "../src/marking";

const mockGetAtlaContext = getAtlaContext as jest.MockedFunction<
	typeof getAtlaContext
>;

describe("marking", () => {
	let baseTest: BaseAtlaTest;

	beforeEach(() => {
		baseTest = new BaseAtlaTest();
		baseTest.beforeEach();

		// Reset mocks
		jest.clearAllMocks();
		mockRootSpan.setAttribute.mockClear();

		mockGetAtlaContext.mockReturnValue({
			rootSpan: mockRootSpan as any,
		});
	});

	afterEach(() => {
		baseTest.afterEach();
	});

	describe("markSuccess", () => {
		it("should mark root span as successful", () => {
			markSuccess();

			expect(mockRootSpan.setAttribute).toHaveBeenCalledWith(SUCCESS_MARK, 1);
		});

		it("should throw error when no root span available", () => {
			mockGetAtlaContext.mockReturnValue({});

			expect(() => markSuccess()).toThrow(
				"Atla marking can only be done within an instrumented function.",
			);
		});

		it("should throw error when no context available", () => {
			mockGetAtlaContext.mockReturnValue(undefined);

			expect(() => markSuccess()).toThrow(
				"Atla marking can only be done within an instrumented function.",
			);
		});
	});

	describe("markFailure", () => {
		it("should mark root span as failed", () => {
			markFailure();

			expect(mockRootSpan.setAttribute).toHaveBeenCalledWith(SUCCESS_MARK, 0);
		});

		it("should throw error when no root span available", () => {
			mockGetAtlaContext.mockReturnValue({});

			expect(() => markFailure()).toThrow(
				"Atla marking can only be done within an instrumented function.",
			);
		});
	});
});
