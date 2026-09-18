/**
 * Strategy factory and registry
 * Central location for strategy creation and discovery
 */

import type { Logger } from 'pino';
import type { ChunkingConfig, ChunkingStrategyName } from '../lib/types.js';
import { AriaHeadingEnrichedStrategy } from './aria/heading-enriched-strategy.js';
import { GenericHierarchicalStrategy } from './generic/hierarchical-strategy.js';
import type { IChunkingStrategy } from './types.js';

// Strategy registry - maps strategy names to their classes
const strategyRegistry = new Map<
	ChunkingStrategyName,
	new (
		config: ChunkingConfig,
		logger: Logger
	) => IChunkingStrategy
>();

// Register built-in strategies
strategyRegistry.set('generic.hierarchical', GenericHierarchicalStrategy);
strategyRegistry.set('aria.heading-enriched', AriaHeadingEnrichedStrategy);

/**
 * Create strategy instance from name
 * @param name - Strategy name (domain.method format)
 * @param config - Full chunking configuration
 * @param logger - Pino logger
 * @returns Initialized and validated strategy instance
 * @throws Error if strategy name is unknown
 */
export function createStrategy(name: ChunkingStrategyName, config: ChunkingConfig, logger: Logger): IChunkingStrategy {
	const StrategyClass = strategyRegistry.get(name);

	if (!StrategyClass) {
		const available = [...strategyRegistry.keys()].join(', ');
		throw new Error(`Unknown chunking strategy: ${name}. Available strategies: ${available}`);
	}

	logger.debug({ strategy: name }, 'Creating strategy instance');

	const strategy = new StrategyClass(config, logger);
	strategy.validateConfig();

	logger.info({ strategy: name, domain: strategy.domain, method: strategy.method }, 'Strategy created and validated');

	return strategy;
}

/**
 * Get all available strategy names
 * @returns Array of registered strategy names
 */
export function getAvailableStrategies(): ChunkingStrategyName[] {
	return [...strategyRegistry.keys()];
}

/**
 * Get strategies for a specific domain
 * @param domain - Domain name (e.g., 'generic', 'aria', 'legal')
 * @returns Array of strategy names in that domain
 */
export function getStrategiesByDomain(domain: string): ChunkingStrategyName[] {
	return [...strategyRegistry.keys()].filter(name => name.startsWith(`${domain}.`));
}

/**
 * Check if a strategy is registered
 * @param name - Strategy name to check
 * @returns True if strategy exists
 */
export function hasStrategy(name: ChunkingStrategyName): boolean {
	return strategyRegistry.has(name);
}
