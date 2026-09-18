/**
 * Service orchestration for vector-indexer
 * Automatically starts and manages Docker/Qdrant and llama-servers based on config
 */

import type { ChildProcess } from 'node:child_process';
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import type { Logger } from 'pino';
import type { ServicesConfig, ShutdownOptions, VectorIndexerConfig } from '../lib/types.js';

export class ServiceManager {
	private logger: Logger;
	private config: VectorIndexerConfig;
	private servicesConfig: ServicesConfig;
	private processes: Map<string, ChildProcess>;
	private started: Set<string>;

	constructor(config: VectorIndexerConfig, logger: Logger) {
		this.config = config;
		this.servicesConfig = config.services;
		this.logger = logger;
		this.processes = new Map();
		this.started = new Set();
	}

	/**
	 * Start all required services based on configuration
	 */
	async startServices(): Promise<void> {
		if (!this.servicesConfig.autoStart) {
			this.logger.debug('Auto-start disabled, skipping service orchestration');
			return;
		}

		const startTime = Date.now();

		// Announce what services will be checked/started
		const requiredServices: string[] = ['Qdrant'];
		if (this.config.embedding.provider === 'llama-cpp') {
			requiredServices.push('Embeddings (llama-server)');
		} else if (this.config.embedding.provider === 'ollama') {
			requiredServices.push('Ollama (embeddings)');
		}

		if (this.config.reranker.provider === 'llama-cpp') {
			requiredServices.push('Reranker (llama-server)');
		} else if (this.config.reranker.provider === 'ollama' && !requiredServices.includes('Ollama (embeddings)')) {
			requiredServices.push('Ollama (reranker)');
		}

		this.logger.info(
			{
				action: 'orchestration_start',
				services: requiredServices,
				count: requiredServices.length,
			},
			`Starting service orchestration: ${requiredServices.join(', ')} (${requiredServices.length} total)`
		);

		try {
			let currentService = 1;
			const totalServices = requiredServices.length;

			// Always need Qdrant
			this.logger.info(
				{ progress: `${currentService}/${totalServices}` },
				`[${currentService}/${totalServices}] Checking Qdrant`
			);
			await this.ensureQdrant();
			currentService++;

			// Check embedding provider
			if (this.config.embedding.provider === 'llama-cpp') {
				this.logger.info(
					{ progress: `${currentService}/${totalServices}` },
					`[${currentService}/${totalServices}] Checking Embeddings`
				);
				await this.ensureLlamaServerEmbeddings();
				currentService++;
			} else if (this.config.embedding.provider === 'ollama') {
				this.logger.info(
					{ progress: `${currentService}/${totalServices}` },
					`[${currentService}/${totalServices}] Checking Ollama`
				);
				await this.ensureOllama();
				currentService++;
			}

			// Check reranker provider (avoid starting Ollama twice)
			if (this.config.reranker.provider === 'llama-cpp') {
				this.logger.info(
					{ progress: `${currentService}/${totalServices}` },
					`[${currentService}/${totalServices}] Checking Reranker`
				);
				await this.ensureLlamaServerReranker();
			} else if (this.config.reranker.provider === 'ollama' && !this.started.has('ollama')) {
				this.logger.info(
					{ progress: `${currentService}/${totalServices}` },
					`[${currentService}/${totalServices}] Checking Ollama`
				);
				await this.ensureOllama();
			}

			const duration = ((Date.now() - startTime) / 1000).toFixed(1);
			this.logger.info(
				{
					action: 'orchestration_complete',
					services: Array.from(this.started),
					healthyCount: this.started.size,
					totalCount: totalServices,
					duration,
				},
				`All services ready (${this.started.size}/${totalServices} healthy, ${duration}s)`
			);
		} catch (error) {
			this.logger.error({ error }, 'Service orchestration failed');
			throw error;
		}
	}

	/**
	 * Ensure Qdrant is running (via Docker)
	 */
	private async ensureQdrant(): Promise<void> {
		this.logger.debug({ service: 'qdrant', action: 'checking' }, 'Checking Qdrant status');

		// Check if container exists (running or stopped)
		const containerExists = await this.checkQdrantContainerExists();
		const containerRunning = await this.checkQdrantContainerRunning();

		if (containerExists && containerRunning) {
			this.logger.info({ service: 'qdrant', status: 'running' }, 'Qdrant container running, checking health');
			// Container is running, just wait for it to be healthy
			await this.waitForService('qdrant', () => this.checkQdrant(), 'Qdrant');
			this.started.add('qdrant');
			this.logger.info({ service: 'qdrant', status: 'healthy' }, 'Qdrant is healthy');
			return;
		}

		if (containerExists && !containerRunning) {
			this.logger.info(
				{
					service: 'qdrant',
					status: 'stopped',
					action: 'starting',
				},
				'Qdrant container stopped, starting it now'
			);
		} else {
			this.logger.info(
				{
					service: 'qdrant',
					action: 'creating',
					method: 'docker-compose',
				},
				'Creating Qdrant container via Docker Compose'
			);
		}

		// Start or create the container
		await this.startQdrantDocker();
		this.logger.info(
			{ service: 'qdrant', action: 'waiting' },
			'Waiting for Qdrant to be healthy (may take up to 90s)'
		);
		await this.waitForService('qdrant', () => this.checkQdrant(), 'Qdrant');

		this.started.add('qdrant');
		this.logger.info(
			{
				service: 'qdrant',
				status: 'started',
				host: this.config.qdrant.host,
				port: this.config.qdrant.port,
				storage: this.config.paths.output.qdrant,
			},
			'Qdrant started successfully'
		);
	}

	/**
	 * Check if Qdrant Docker container exists (running or stopped)
	 */
	private async checkQdrantContainerExists(): Promise<boolean> {
		try {
			const containerName = this.servicesConfig.docker.containerName;
			const { stdout } = await this.execAsync(
				`docker ps -a --filter name=${containerName} --format "{{.Names}}"`
			);
			return stdout.trim() === containerName;
		} catch {
			return false;
		}
	}

	/**
	 * Check if Qdrant Docker container is running (not just exists)
	 */
	private async checkQdrantContainerRunning(): Promise<boolean> {
		try {
			const containerName = this.servicesConfig.docker.containerName;
			const { stdout } = await this.execAsync(`docker ps --filter name=${containerName} --format "{{.Names}}"`);
			return stdout.trim() === containerName;
		} catch {
			return false;
		}
	}

	/**
	 * Start Qdrant via Docker Compose
	 */
	private async startQdrantDocker(): Promise<void> {
		return new Promise((resolve, reject) => {
			const composeFile = this.config.paths.input.compose;
			const proc = spawn('docker', ['compose', '-f', composeFile, 'up', '-d'], {
				stdio: 'pipe',
			});

			let output = '';
			proc.stdout?.on('data', data => {
				output += data.toString();
			});
			proc.stderr?.on('data', data => {
				output += data.toString();
			});

			proc.on('close', code => {
				if (code === 0) {
					this.logger.debug({ output }, 'Docker Compose started');
					resolve();
				} else {
					this.logger.error({ code, output }, 'Docker Compose failed');
					reject(new Error(`Docker Compose failed with code ${code}`));
				}
			});
		});
	}

	/**
	 * Ensure llama-server is running for embeddings
	 */
	private async ensureLlamaServerEmbeddings(): Promise<void> {
		const host = this.config.llamaCppEmbeddings.host;

		this.logger.debug({ service: 'llama-server-embeddings', action: 'checking' }, 'Checking llama-server status');

		if (await this.checkLlamaServer(host)) {
			this.logger.info(
				{ service: 'llama-server-embeddings', status: 'running', host },
				'llama-server (embeddings) already running'
			);
			this.started.add('llama-embeddings');
			return;
		}

		// Use configured model path (no Ollama dependency)
		const modelPath = this.config.llamaCppEmbeddings.modelPath.replace('~', homedir());

		if (!modelPath || modelPath.includes('~')) {
			throw new Error(
				'llama_cpp_embeddings.model_path not configured. ' +
					`Find your path: ollama show ${this.config.embedding.model} --modelfile | grep "^FROM "`
			);
		}

		const port = this.extractPort(this.config.llamaCppEmbeddings.host);
		const hostBinding = this.servicesConfig.llamaServer.hostBinding;
		const gpuLayers = this.servicesConfig.llamaServer.gpuLayers.toString();

		this.logger.info(
			{
				service: 'llama-server-embeddings',
				action: 'starting',
				model: this.config.embedding.model,
				modelPath,
				port,
				hostBinding,
				gpuLayers,
			},
			'Starting llama-server for embeddings'
		);

		const args = ['--embeddings', '-m', modelPath, '--port', port, '--host', hostBinding, '-ngl', gpuLayers];
		if (this.servicesConfig.llamaServer.disableLogging) {
			args.push('--log-disable');
		}

		const proc = spawn('llama-server', args, {
			detached: true,
			stdio: 'ignore',
		});

		proc.unref();
		this.processes.set('llama-embeddings', proc);

		// Save PID if shutdown on exit is enabled
		if (this.servicesConfig.shutdownOnExit && proc.pid !== undefined) {
			this.savePID('llama-embeddings', proc.pid);
		}

		await this.waitForService('llama-embeddings', () => this.checkLlamaServer(host), 'llama-server (embeddings)');

		this.started.add('llama-embeddings');
		this.logger.info(
			{
				service: 'llama-server-embeddings',
				status: 'started',
				port,
				pid: proc.pid,
			},
			'llama-server (embeddings) ready'
		);
	}

	/**
	 * Ensure llama-server is running for reranking
	 */
	private async ensureLlamaServerReranker(): Promise<void> {
		const host = this.config.llamaCppReranker.host;

		this.logger.debug({ service: 'llama-server-reranker', action: 'checking' }, 'Checking llama-server status');

		if (await this.checkLlamaServer(host)) {
			this.logger.info(
				{ service: 'llama-server-reranker', status: 'running', host },
				'llama-server (reranker) already running'
			);
			this.started.add('llama-reranker');
			return;
		}

		// Use configured model path (no Ollama dependency)
		const modelPath = this.config.llamaCppReranker.modelPath.replace('~', homedir());

		if (!modelPath || modelPath.includes('~')) {
			throw new Error(
				'llama_cpp_reranker.model_path not configured. ' +
					`Find your path: ollama show ${this.config.reranker.model} --modelfile | grep "^FROM "`
			);
		}

		const port = this.extractPort(this.config.llamaCppReranker.host);
		const hostBinding = this.servicesConfig.llamaServer.hostBinding;
		const gpuLayers = this.servicesConfig.llamaServer.gpuLayers.toString();

		this.logger.info(
			{
				service: 'llama-server-reranker',
				action: 'starting',
				model: this.config.reranker.model,
				modelPath,
				port,
				hostBinding,
				gpuLayers,
			},
			'Starting llama-server for reranking'
		);

		const args = ['-m', modelPath, '--port', port, '--host', hostBinding, '-ngl', gpuLayers];
		if (this.servicesConfig.llamaServer.disableLogging) {
			args.push('--log-disable');
		}

		const proc = spawn('llama-server', args, {
			detached: true,
			stdio: 'ignore',
		});

		proc.unref();
		this.processes.set('llama-reranker', proc);

		if (this.servicesConfig.shutdownOnExit && proc.pid !== undefined) {
			this.savePID('llama-reranker', proc.pid);
		}

		await this.waitForService('llama-reranker', () => this.checkLlamaServer(host), 'llama-server (reranker)');

		this.started.add('llama-reranker');
		this.logger.info(
			{
				service: 'llama-server-reranker',
				status: 'started',
				port,
				pid: proc.pid,
			},
			'llama-server (reranker) ready'
		);
	}

	/**
	 * Ensure Ollama is running
	 */
	private async ensureOllama(): Promise<void> {
		if (this.started.has('ollama')) {
			return; // Already checked
		}

		this.logger.debug({ service: 'ollama', action: 'checking' }, 'Checking Ollama status');

		if (await this.checkOllama()) {
			this.logger.info({ service: 'ollama', status: 'running' }, 'Ollama already running');
			this.started.add('ollama');
			return;
		}

		this.logger.error(
			{ service: 'ollama', status: 'not_running' },
			'Ollama is not running and cannot be auto-started'
		);

		throw new Error(
			'Ollama is not running. Please start Ollama manually:\n' +
				'  - macOS: Open Ollama.app\n' +
				'  - CLI: ollama serve'
		);
	}

	/**
	 * Check if Qdrant is running and ready
	 */
	private async checkQdrant(): Promise<boolean> {
		try {
			// Use /readyz endpoint (Qdrant's standard readiness check)
			const response = await fetch(`http://${this.config.qdrant.host}:${this.config.qdrant.port}/readyz`, {
				signal: AbortSignal.timeout(5000),
			});
			return response.ok;
		} catch {
			return false;
		}
	}

	/**
	 * Check if llama-server is running
	 */
	private async checkLlamaServer(host: string): Promise<boolean> {
		try {
			const response = await fetch(`${host}/health`, {
				signal: AbortSignal.timeout(5000),
			});
			return response.ok;
		} catch {
			return false;
		}
	}

	/**
	 * Check if Ollama is running
	 */
	private async checkOllama(): Promise<boolean> {
		try {
			const response = await fetch(`${this.config.ollama.host}/api/tags`, {
				signal: AbortSignal.timeout(5000),
			});
			return response.ok;
		} catch {
			return false;
		}
	}

	/**
	 * Wait for service to become healthy
	 */
	private async waitForService(
		serviceName: string,
		checkFn: () => Promise<boolean>,
		displayName: string
	): Promise<void> {
		const maxWait = this.servicesConfig.startupTimeoutSeconds * 1000;
		const interval = this.servicesConfig.healthCheckIntervalMs;
		const startTime = Date.now();
		let lastLogTime = startTime;

		this.logger.debug({ service: serviceName, timeout: maxWait }, 'Waiting for service to be healthy');

		while (Date.now() - startTime < maxWait) {
			if (await checkFn()) {
				const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
				this.logger.info({ service: serviceName, elapsed }, `✓ ${displayName} healthy (${elapsed}s)`);
				return;
			}

			// Log progress every 5 seconds
			const now = Date.now();
			if (now - lastLogTime >= 5000) {
				const elapsed = ((now - startTime) / 1000).toFixed(0);
				this.logger.info(
					{ service: serviceName, elapsed, maxWait: this.servicesConfig.startupTimeoutSeconds },
					`Waiting for ${displayName} health check... ${elapsed}s elapsed`
				);
				lastLogTime = now;
			}

			await this.sleep(interval);
		}

		throw new Error(`${displayName} failed to start within ${this.servicesConfig.startupTimeoutSeconds} seconds`);
	}

	/**
	 * Save process PID to file
	 */
	private savePID(serviceName: string, pid: number): void {
		const dir = this.config.paths.output.pids.replace('~', homedir());

		if (!existsSync(dir)) {
			mkdirSync(dir, { recursive: true });
		}

		const pidFile = `${dir}/${serviceName}.pid`;
		writeFileSync(pidFile, pid.toString());

		this.logger.debug({ service: serviceName, pid, pidFile }, 'PID saved');
	}

	/**
	 * Shutdown Docker container (Qdrant)
	 */
	private async shutdownDocker(): Promise<void> {
		const containerName = this.servicesConfig.docker.containerName;

		try {
			this.logger.info({ container: containerName, action: 'stopping' }, 'Stopping Docker container');

			await this.execAsync(`docker stop ${containerName}`);

			this.logger.info({ container: containerName, status: 'stopped' }, 'Docker container stopped');
		} catch (error) {
			this.logger.warn({ container: containerName, error }, 'Failed to stop Docker container');
		}
	}

	/**
	 * Shutdown llama-server processes
	 */
	private async shutdownLlamaServers(): Promise<void> {
		this.logger.info('Shutting down llama-server processes');

		// First, try to kill processes we started
		for (const [name, proc] of this.processes.entries()) {
			try {
				proc.kill();
				this.logger.info({ service: name, pid: proc.pid }, 'llama-server process killed');
			} catch (error) {
				this.logger.warn({ service: name, error }, 'Failed to kill llama-server process from Map');
			}
		}

		// Then find and kill any other running llama-server processes
		try {
			const { stdout } = await this.execAsync('pgrep -f "llama-server"');
			const pids = stdout
				.trim()
				.split('\n')
				.filter(pid => pid);

			if (pids.length > 0) {
				this.logger.info({ pids }, 'Found additional llama-server processes');
				for (const pid of pids) {
					try {
						await this.execAsync(`kill ${pid}`);
						this.logger.info({ pid }, 'Killed llama-server process');
					} catch (error) {
						this.logger.warn({ pid, error }, 'Failed to kill llama-server process');
					}
				}
			}
		} catch (_error) {
			// pgrep returns non-zero if no processes found - that's okay
			this.logger.debug('No additional llama-server processes found');
		}
	}

	/**
	 * Shutdown specific service
	 */
	private async shutdownService(serviceName: string): Promise<void> {
		if (serviceName === 'qdrant' || serviceName === 'docker') {
			await this.shutdownDocker();
		} else if (serviceName === 'embeddings' || serviceName === 'llama-embeddings') {
			const proc = this.processes.get('llama-embeddings');
			if (proc) {
				proc.kill();
				this.logger.info({ service: 'llama-embeddings', pid: proc.pid }, 'Embeddings server stopped');
			} else {
				this.logger.warn({ service: 'llama-embeddings' }, 'Embeddings server not found');
			}
		} else if (serviceName === 'reranker' || serviceName === 'llama-reranker') {
			const proc = this.processes.get('llama-reranker');
			if (proc) {
				proc.kill();
				this.logger.info({ service: 'llama-reranker', pid: proc.pid }, 'Reranker server stopped');
			} else {
				this.logger.warn({ service: 'llama-reranker' }, 'Reranker server not found');
			}
		} else {
			this.logger.error({ service: serviceName }, 'Unknown service name');
			throw new Error(`Unknown service: ${serviceName}`);
		}
	}

	/**
	 * Shutdown managed services with options
	 */
	async shutdown(options: ShutdownOptions = {}): Promise<void> {
		// Check if we should proceed (unless force is true)
		if (!options.force && !this.servicesConfig.shutdownOnExit) {
			this.logger.info('Shutdown on exit disabled, leaving services running');
			this.logger.info('Use --force to override this setting');
			return;
		}

		this.logger.info(
			{
				options,
				services: Array.from(this.started),
			},
			'Starting service shutdown'
		);

		// Specific service shutdown
		if (options.service) {
			await this.shutdownService(options.service);
			this.logger.info('Service shutdown complete');
			return;
		}

		// Selective shutdown
		if (options.docker || options.all) {
			await this.shutdownDocker();
		}

		if (options.llama || options.all) {
			await this.shutdownLlamaServers();
		}

		// Default behavior (all if no flags specified)
		if (!options.docker && !options.llama && !options.all && !options.service) {
			await this.shutdownDocker();
			await this.shutdownLlamaServers();
		}

		this.logger.info('Service shutdown complete');
	}

	/**
	 * Execute async command
	 */
	private async execAsync(command: string): Promise<{ stdout: string; stderr: string }> {
		return new Promise((resolve, reject) => {
			const proc = spawn('sh', ['-c', command], { stdio: 'pipe' });

			let stdout = '';
			let stderr = '';

			proc.stdout?.on('data', data => {
				stdout += data.toString();
			});
			proc.stderr?.on('data', data => {
				stderr += data.toString();
			});

			proc.on('close', code => {
				if (code === 0) {
					resolve({ stdout, stderr });
				} else {
					reject(new Error(`Command failed with code ${code}: ${stderr}`));
				}
			});
		});
	}

	/**
	 * Extract port from URL
	 */
	private extractPort(url: string): string {
		const match = url.match(/:(\d+)/);
		return match ? match[1] : '8080';
	}

	/**
	 * Sleep utility
	 */
	private sleep(ms: number): Promise<void> {
		return new Promise(resolve => setTimeout(resolve, ms));
	}
}
