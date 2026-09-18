import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock cli-progress with hoisted pattern to survive vi.clearAllMocks()
const { mockStart, mockStop, mockUpdate, MockSingleBar, mockLogger, mockCreateLogger } = vi.hoisted(() => {
	const mockStart = vi.fn();
	const mockStop = vi.fn();
	const mockUpdate = vi.fn();
	const mockGetTotal = vi.fn(() => 10);
	const mockGetProgress = vi.fn(() => 5);
	const mockLogger = {
		info: vi.fn(),
		warn: vi.fn(),
		error: vi.fn(),
		debug: vi.fn(),
		fatal: vi.fn(),
		trace: vi.fn(),
		silent: vi.fn(),
		level: 'info',
		child: vi.fn(),
	};
	const mockCreateLogger = vi.fn(() => mockLogger);

	const MockConstructor = vi.fn(function (this: unknown) {
		return {
			start: mockStart,
			stop: mockStop,
			update: mockUpdate,
			getTotal: mockGetTotal,
			getProgress: mockGetProgress,
		};
	});

	return {
		mockStart,
		mockStop,
		mockUpdate,
		MockSingleBar: MockConstructor,
		mockLogger,
		mockCreateLogger,
	};
});

vi.mock('cli-progress', () => ({
	__esModule: true,
	default: {
		SingleBar: MockSingleBar,
	},
}));

vi.mock('../../src/lib/logger.js', () => ({
	createLogger: mockCreateLogger,
}));

import { ProgressLogger } from '../../src/utils/progress-logger.js';

describe('ProgressLogger', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('given ProgressLogger without progress bar, when log called, then should call logger.info', () => {
		const logger = new ProgressLogger();

		logger.log('test message');

		expect(mockLogger.info).toHaveBeenCalledWith('test message');
	});

	it('given ProgressLogger without progress bar, when warn called, then should call logger.warn', () => {
		const logger = new ProgressLogger();

		logger.warn('warning message');

		expect(mockLogger.warn).toHaveBeenCalledWith('warning message');
	});

	it('given ProgressLogger without progress bar, when error called, then should call logger.error', () => {
		const logger = new ProgressLogger();

		logger.error('error message');

		expect(mockLogger.error).toHaveBeenCalledWith('error message');
	});

	it('given ProgressLogger with progress bar, when log called, then should stop, log, and restart progress bar', async () => {
		const logger = new ProgressLogger();
		await logger.start(10);

		logger.log('test message');

		expect(mockStop).toHaveBeenCalled();
		expect(mockLogger.info).toHaveBeenCalledWith('test message');
		expect(mockStart).toHaveBeenCalledWith(10, 5);
	});

	it('given a total value, when start is called, then it should create and start a new progress bar', async () => {
		const logger = new ProgressLogger();

		await logger.start(10);

		expect(MockSingleBar).toHaveBeenCalledTimes(1);
		expect(mockStart).toHaveBeenCalledWith(10, 0);
	});

	it('given a value, when update is called, then it should call the update method on the progress bar', async () => {
		const logger = new ProgressLogger();
		await logger.start(10);

		logger.update(5);

		expect(mockUpdate).toHaveBeenCalledWith(5);
	});

	it('given a progress bar, when stop is called, then it should call the stop method on the progress bar', async () => {
		const logger = new ProgressLogger();
		await logger.start(10);

		logger.stop();

		expect(mockStop).toHaveBeenCalledTimes(1);
	});
});
