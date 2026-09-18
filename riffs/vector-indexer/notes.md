# Vector-Indexer Implementation Notes

Date: 2025-11-25
Status: Service management complete, core functionality to be tested

## High-Level Architecture Assessment

### What's Working Exceptionally Well

#### 1. Configuration-Driven Philosophy

- Zero hard-coded values in source code
- Everything configurable via YAML
- Docker container names, compose paths, llama-server flags all in config
- Users can customize behavior without touching code

#### 2. Service Orchestration is Intelligent

- Smart detection (running vs stopped vs doesn't exist)
- Doesn't restart already-running services
- Selective shutdown (--all, --docker, --llama, --service)
- Handles stopped containers correctly (bug fixed today)
- Auto-starts services for all commands except shutdown

#### 3. Progressive Disclosure UX

- Upfront announcement: "Starting 3 services: Qdrant, Embeddings, Reranker"
- Progress tracking: [1/3] [2/3] [3/3]
- Health check timing: "OK Qdrant healthy (1.0s)"
- Completion summary: "All services ready (3/3 healthy, 4.2s)"
- Status as default command - immediate full context

#### 4. Pure Pino Logging

- Single logging system for everything
- No console.log mixing (except raw JSON output)
- Structured, timestamped, parseable
- Beautiful pretty-printing by default

#### 5. Multi-Provider Pattern

- Can swap Ollama/llama.cpp via config
- Future-proof for additional providers
- Clean abstraction with interfaces

#### 6. CLI Architecture

- Thin adapter (cli.ts) translates args to core logic
- Fat core (business logic is reusable)
- Provider isolation (external services wrapped)
- No protocol leakage

## What We've Actually Tested

### Service Management (Verified Working)

- Cold start from zero services
- Warm start (services already running)
- Stopped container detection and restart
- Shutdown --all, --docker, --llama
- Shutdown specific services
- Health checks for all services
- Smart detection (doesn't restart running services)

### Search Functionality (Verified Working)

- Search query: "who is the CTO of Cello"
- Found: Ivan Walker (Chief Technology Officer)
- Hybrid search + reranking working
- llama.cpp providers working (embeddings + reranker)
- Results properly scored and ranked

### Status Display (Verified Working)

- Default command (no args) shows full status
- Service health checks
- Collection listing
- Model information
- Storage paths
- JSON output mode (--json)

## What Hasn't Been Tested Yet

### Core Functionality (Unknown)

- Indexing new documents - Primary use case!
- Hierarchical chunking - The core differentiator
- Metadata extraction - Regex patterns from config
- Embedding generation - Is it calling llama-server correctly?
- Sparse vectors (BM25) - Is this actually implemented?
- Collection creation - Can we create new collections?
- Batch processing - Does batch indexing work?

### Error Handling (Unknown)

- What if Qdrant fails to start?
- What if embedding generation fails?
- What if a document can't be parsed?
- What if model path is invalid?
- Are error messages helpful for debugging?

### Edge Cases (Unknown)

- Very large documents (>100KB)
- Documents without proper headings
- Empty collections
- Concurrent operations
- Out of memory scenarios

### Testing Coverage (Unknown)

- Unit tests exist?
- Integration tests run?
- Coverage percentage?
- Performance benchmarks?

## Architectural Concerns

### 1. Service Manager Class is Doing Too Much

#### Current Responsibilities

- Docker container management
- Process spawning (llama-server)
- Health checking (HTTP endpoints)
- PID file tracking
- Startup orchestration
- Shutdown orchestration
- Command execution (docker, pgrep, kill)

#### Better Architecture

```text
ServiceOrchestrator
  ├─ ContainerManager (Docker/Podman abstraction)
  ├─ ProcessManager (llama-server lifecycle)
  └─ HealthChecker (HTTP health endpoints)
```

#### Benefits

- Single Responsibility Principle
- Easier to test
- Could support Podman/Rancher Desktop
- More maintainable

### 2. Docker Dependency Still Exists

The plan mentions eliminating Docker dependency, but we're locked into:

- `docker ps -a`
- `docker stop`
- `docker-compose up`

**Alternatives mentioned in plan:**

- qdrant-npm (npm package that downloads Qdrant binary)
- LanceDB (pure Node.js, no external processes)
- SQLite with vector extension

**Current state:** Docker works, but inconsistent with "zero-server" philosophy

### 3. Model Path User Experience

Current config requires ugly paths:

```yaml
model_path: '~/.ollama/models/blobs/sha256-3fcd3febec8b...'
```

#### Issues

- Users don't know what this SHA is
- Can't verify it's the right model
- Hard to update
- Error-prone to configure

#### Better UX (Future)

```yaml
# Riff automatically finds model via Ollama API
embedding_model: 'qwen3-embedding:8b' # Just the name
reranker_model: 'dengcao/Qwen3-Reranker-4B:Q5_K_M'

# OR: Copy models to clean location
model_directory: '~/.aria/models/'
# Riff copies: sha256-xxx → qwen3-embedding-8b.gguf
```

### 4. No Graceful Degradation

If a service fails:

- Whole system fails?
- Or continue with reduced functionality?

#### Example Scenarios

- Reranker unavailable → Continue with just embeddings?
- Sparse vectors fail → Continue with just dense?
- Secondary model fails → Use fallback?

Current behavior: Unknown - need to test failure cases

### 5. Configuration Complexity

The YAML has approximately 150 lines with many nested options:

- llama_cpp_embeddings vs llama_cpp_reranker
- Multiple timeout settings
- Chunking strategies with many parameters
- Service orchestration settings
- Logging configuration

For new users: Overwhelming

#### Recommendation

- Provide `config-simple.yaml` (minimal, sensible defaults)
- Provide `config-advanced.yaml` (all options documented)
- Auto-generate config with `setup` command

## Practical Usage Concerns

### 1. Error Messages Quality (Unknown)

Haven't seen failure cases. Questions:

- If Qdrant times out, does the error say "Check if Docker is installed"?
- If model path is wrong, does it suggest how to find the right path?
- If port is in use, does it show what's using it?

#### Good Error Message

```text
ERROR: Qdrant failed to start within 120s

Troubleshooting:
  1. Check Docker is running: docker ps
  2. Check logs: docker logs aria-qdrant
  3. Try manual start: cd riffs/vector-indexer/docker && docker-compose up
  4. Increase timeout in config: services.startup_timeout_seconds
```

#### Bad Error Message

```text
ERROR: Service orchestration failed
```

### 2. Search Results Quality (Partial Validation)

The search found Ivan Walker, but:

- Was it the BEST result? (It was #2, not #1)
- Why wasn't his profile #1?
- Are the scores meaningful?
- Is reranking actually improving results?

#### Need A/B Testing

- Search with reranking vs without
- Compare result quality
- Validate reranking is helping

### 3. Collections Introspection is Weak

Current: `collections --list` just shows names

#### Better

```bash
bun ... collections --info cello-staff

Collection: cello-staff
  Documents: 142 indexed
  Chunks: 1,234 vectors
  Source: /Users/.../exports/cello/staff/
  Indexed: 2 hours ago
  Model: qwen3-embedding:8b (4096 dims)
  Sample documents:
    - ivan-walker-profile.md
    - patricia-aquino-profile.md
    - ...
```

Helps agents understand what they're searching.

### 4. Startup Time Opacity

"May take up to 90s" - but actually takes 1-4s

#### Questions

- Why 90s timeout if it's usually 1s?
- What if it actually takes 60s - is something wrong?
- Should we warn if startup is unusually slow?

#### Better UX

```text
Qdrant typical startup: 1-3s (timeout: 90s)
[If takes >10s] WARNING: Slow startup, check Docker resources
```

### 5. Memory Management Claims Unverified

Config has:

```yaml
memory_threshold_gb: 16 # Select 4B vs 8B model
auto_select_model: true
```

#### Questions About Implementation

- Is this actually implemented?
- Does it check available memory?
- Does it switch models?
- What happens if both models won't fit?

## What Should Be Tested Tomorrow

### Priority 1: Core Indexing Pipeline

```bash
# Create test documents
mkdir -p /tmp/test-docs
echo "# Test Document\n\nContent here" > /tmp/test-docs/test.md

# Index them
bun ... index /tmp/test-docs -c test-fresh

# Verify indexed
bun ... collections --info test-fresh

# Search them
bun ... search "content" -c test-fresh
```

#### Validates Pipeline

- File scanning works
- Markdown parsing works
- Chunking works
- Embedding generation works
- Qdrant storage works
- Search retrieval works

### Priority 2: Error Handling

#### Test Failure Scenarios

```bash
# Invalid model path
# Wrong collection name
# Qdrant not running (shutdown Docker first)
# Malformed YAML config
# Port already in use
# Out of disk space (simulate)
```

#### Validates Error Handling

- Error messages are helpful
- System fails gracefully
- Recovery instructions provided

### Priority 3: Hierarchical Chunking

#### Test with Complex Document

- Multiple heading levels (H1 → H2 → H3 → H4)
- Large sections (>2048 tokens)
- Tables, code blocks (should preserve)
- No headings (should fallback to paragraphs)

#### Validates Chunking

- Chunking strategy works as designed
- Semantic boundaries respected
- Context preserved

### Priority 4: Performance and Scale

#### Test with Realistic Dataset

- 100+ documents
- Various sizes
- Check indexing speed
- Check memory usage
- Check search latency

#### Validates Performance

- Batch processing works
- Memory stays within bounds
- Performance is acceptable

### Priority 5: Configuration Edge Cases

#### Test with Different Configs

- Ollama provider instead of llama.cpp
- Different embedding dimensions
- Disabled reranking
- Disabled sparse vectors
- Custom chunking parameters

#### Validates Configuration

- Multi-provider support works
- Configuration is respected
- Fallbacks work

## Architectural Improvements to Consider

### Short Term (Next Session)

1. Test the indexing pipeline - Verify core functionality works
2. Improve error messages - Add troubleshooting guidance
3. Add collection introspection - Better --info output
4. Document happy path - README with quick start

### Medium Term (This Week)

1. Split ServiceManager - Separate concerns (Container, Process, Health)
2. Add model path auto-discovery - Find Ollama models automatically
3. Add graceful degradation - Continue if optional features fail
4. Add configuration validation - Check config before starting services
5. Run existing tests - Verify test coverage

### Long Term (Future Enhancements)

1. Container runtime abstraction - Support Docker/Podman/etc
2. Eliminate Docker dependency - Use qdrant-npm or LanceDB
3. Configuration profiles - Simple vs Advanced presets
4. Model management - Download, verify, update models
5. Performance optimization - Parallel startup, caching, etc.

## Questions for Tomorrow

1. Does indexing actually work? Test end-to-end pipeline
2. Is chunking implemented? Check src/core/chunker.ts
3. Are tests written? Check test/ directory
4. What's the test coverage? Run tests and see
5. How are errors handled? Test failure scenarios
6. Is documentation complete? Check README
7. Does it work with Ollama? Test alternative provider
8. Can it handle large documents? Performance testing
9. Is metadata extraction working? Test regex patterns
10. Are the blob paths necessary? Can we auto-discover?

## Recommendations Summary

### Immediate Testing Priorities

1. Index a fresh document set
2. Verify chunking works correctly
3. Test error cases
4. Check existing test suite
5. Validate all config options actually work

### Architecture Improvements

1. Consider splitting ServiceManager into smaller components
2. Abstract container runtime (Docker → generic interface)
3. Add configuration validation upfront
4. Improve model path UX
5. Add graceful degradation for optional features

### Documentation Needs

1. Quick start guide
2. Configuration reference
3. Troubleshooting guide
4. Architecture overview
5. API documentation

## What We Accomplished Today

### Completed

- Eliminated all hard-coded values (moved to config)
- Fixed critical Docker startup bug (stopped containers now start)
- Implemented comprehensive shutdown command
- Converted all logging to Pino (unified system)
- Added progressive disclosure to startup (progress tracking)
- Created status command as default (agent-first UX)
- Added JSON output for machine consumption
- Verified search functionality works (found CTO)

### Service Management Timeline

- Cold start: 4 seconds (Qdrant 1s, Embeddings 1s, Reranker 1s)
- Warm start: <1 second (detects already running)
- Shutdown: <1 second (all services)

### Outstanding

- Need to test primary use case (indexing documents)
- Need to validate chunking implementation
- Need to run test suite
- Need to verify error handling
- Need to check documentation completeness

## Agent UX Evaluation

### What I Like (As an Agent)

#### 1. Immediate Context

- Run CLI with no args → get full system snapshot
- Services auto-start → no separate setup step
- Status shows everything: services, collections, models, storage

#### 2. Progressive Disclosure

- Know scope upfront: "3 services total"
- Track progress: [1/3] [2/3] [3/3]
- See timing: "healthy (1.0s)"
- Clear completion: "3/3 healthy, 4.2s"

#### 3. Structured Output

- All Pino logs have metadata fields
- Can parse programmatically
- JSON mode for machine consumption
- Consistent format across all commands

#### 4. Smart Behavior

- Doesn't restart running services
- Detects stopped containers and starts them
- Selective shutdown (fine-grained control)
- Configuration-driven (no code changes)

### What Could Be Better (Friction Points)

#### 1. Unknown Core Functionality

- Haven't tested indexing (primary purpose!)
- Don't know if chunking works
- Unclear if embedding generation works
- Sparse vectors implementation unknown

#### 2. Collection Discovery Was Required

- Had to run `collections --list` to find "cello-staff"
- Didn't know what collections existed
- Didn't know which one had staff data
- Extra round-trip for discovery

#### 3. No Failure Experience

- Haven't seen error messages
- Don't know if they're helpful
- Can't assess error recovery
- Unclear what troubleshooting looks like

#### 4. Configuration Complexity

- 150+ lines of YAML
- Many nested options
- Which are critical vs optional?
- What happens if misconfigured?

#### 5. Model Path Ugliness

- SHA-256 blob paths are opaque
- Can't verify model identity
- Hard to update or change
- No validation that path is correct model

## Specific Questions to Answer Tomorrow

### Configuration and Setup

1. Is there a `setup` command to help initial configuration?
2. Can the riff auto-discover Ollama model paths?
3. Is there config validation before service startup?
4. What's the minimal viable config (simple mode)?

### Core Functionality

1. Does `index <dir> -c <collection>` actually work?
2. Is hierarchical chunking implemented in src/core/chunker.ts?
3. Are sparse vectors (BM25) actually generated?
4. Is metadata extraction working (regex patterns)?
5. Can we create new collections?
6. Does batch processing work for large document sets?

### Search Quality

1. Is reranking actually improving results?
2. Why was Ivan Walker result #2 not #1?
3. Are search scores meaningful/calibrated?
4. Does hybrid search (dense + sparse) help?
5. Can we search without reranking (faster)?

### Error Handling

1. What happens if Qdrant fails to start?
2. What if llama-server crashes during operation?
3. What if embedding generation fails for a document?
4. Are error messages actionable (tell user how to fix)?
5. Does it gracefully degrade (continue if reranker fails)?

### Testing and Quality

1. Do unit tests exist? Run them.
2. Do integration tests exist? Run them.
3. What's the test coverage percentage?
4. Are there performance benchmarks?
5. Is there a test suite for error cases?

### Documentation

1. Is there a quick start guide?
2. Is there a configuration reference?
3. Is there a troubleshooting guide?
4. Are all commands documented?
5. Are there usage examples?

## Potential Improvements

### Immediate (Next Session)

#### 1. Test Core Indexing Pipeline

```bash
# End-to-end validation
bun ... index /tmp/test-docs -c test
bun ... search "query" -c test
```

#### 2. Improve Collection Introspection

```bash
bun ... collections --info <name>
# Should show: doc count, chunk count, source paths, model used
```

#### 3. Add Config Validation

```bash
bun ... config --validate
# Checks: paths exist, models available, ports free, etc.
```

#### 4. Better Error Messages

- Add troubleshooting hints
- Show relevant config values
- Suggest fixes

### Medium Term (Current Week)

#### 5. Refactor ServiceManager

- Split into ContainerManager, ProcessManager, HealthChecker
- Single Responsibility Principle
- Easier to test and maintain

#### 6. Model Path Auto-Discovery

```typescript
// Instead of requiring SHA paths, discover via Ollama API
async function findModelPath(modelName: string): Promise<string> {
    const modelInfo = await ollama.show(modelName);
    return modelInfo.modelfile.match(/FROM (.*)/)[1];
}
```

#### 7. Add Graceful Degradation

```typescript
// If reranker fails, continue with just embeddings
try {
    await this.ensureLlamaServerReranker();
} catch (error) {
    logger.warn('Reranker unavailable, continuing without reranking');
    config.reranker.enabled = false;
}
```

#### 8. Configuration Profiles

- `config-simple.yaml` - Minimal, sensible defaults
- `config-advanced.yaml` - All options with docs
- `config-ollama.yaml` - Pure Ollama (no llama.cpp)
- `config-llamacpp.yaml` - Pure llama.cpp (current)

### Long Term (Future Plans)

#### 9. Container Runtime Abstraction

```typescript
interface IContainerRuntime {
    start(name: string): Promise<void>;
    stop(name: string): Promise<void>;
    isRunning(name: string): Promise<boolean>;
}

class DockerRuntime implements IContainerRuntime {}
class PodmanRuntime implements IContainerRuntime {}
```

#### 10. Eliminate Docker Dependency

- Investigate qdrant-npm (npm package)
- Investigate LanceDB (pure Node.js)
- Compare performance and features
- Make evidence-based decision

#### 11. Model Management System

```bash
bun ... models --list     # Show available models
bun ... models --download # Download required models
bun ... models --verify   # Verify model checksums
bun ... models --update   # Update to latest versions
```

#### 12. Performance Optimization

- Parallel service startup (start all 3 simultaneously)
- Connection pooling
- Embedding caching
- Memory-efficient batching

## Open Questions

### Architecture

- Is the multi-provider pattern working well or overengineered?
- Should we abstract container runtime now or later?
- Is the config structure intuitive?
- Are we following Aria project standards correctly?

### Functionality

- Does the riff actually work for its primary purpose?
- Is search quality good enough for real use?
- Are the chunking strategies effective?
- Is metadata extraction useful?

### User Experience

- Is the CLI intuitive for first-time users?
- Are error messages helpful?
- Is configuration too complex?
- Do humans and agents have different needs?

### Technical Decisions

- llama.cpp vs Ollama - which is better default?
- Docker vs qdrant-npm - which should we use?
- BM25 sparse vectors - do they actually help?
- Reranking - is it worth the complexity?

## Success Criteria (From Plan)

Original plan defined success as:

- Successfully index 1000+ documents
- Hybrid search returns relevant results
- Re-ranker improves result quality measurably
- Search latency < 2 seconds for typical queries
- Memory usage within limits (4B: <16GB, 8B: <24GB)
- Zero external API calls (100% local)
- Profile system works (legislation/netbox/rfp)
- Integrates with existing Aria riffs
- Complete test coverage (>60%)
- Comprehensive documentation

### Current Validation

- Indexing untested
- Search works (found Ivan Walker in <2s)
- Reranker effectiveness unknown
- Search latency excellent (<1s observed)
- Memory usage not measured
- 100% local (no external APIs)
- Profiles not tested
- Integration untested
- Test coverage unknown
- Documentation incomplete

## Tomorrow's Agenda

1. Test indexing - Index fresh documents, verify it works
2. Validate chunking - Check hierarchical chunking implementation
3. Run test suite - See what tests exist and coverage
4. Test error cases - Intentionally break things, see error messages
5. Review existing collections - How were they created? What's in them?
6. Test with Ollama - Switch provider, verify it works
7. Check documentation - Is README helpful?
8. Measure performance - Index 100 docs, measure time/memory
9. Review all open questions - Get answers to unknowns
10. Plan next steps - Based on what we learn

## Notes

- Service management is rock-solid
- Configuration-driven architecture is excellent
- Pino logging is consistent and professional
- UX is agent-friendly with progressive disclosure
- Need to validate core functionality actually works
- Many questions can only be answered by testing
- Fresh eyes tomorrow will reveal what's real vs assumed
