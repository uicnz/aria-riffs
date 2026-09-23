# Qdrant Docker Setup for Vector Indexer

This directory contains Docker Compose configuration for running Qdrant locally for the vector-indexer riff.

## Quick Start

Start Qdrant:

```bash
cd riffs/vector-indexer/docker
docker compose up -d
```

Stop Qdrant:

```bash
docker compose down
```

View logs:

```bash
docker compose logs -f
```

## Data Location

Qdrant data is stored in `.aria/db/vector-indexer/` (mapped from container's `/qdrant/storage`), maintaining consistency with Aria's data locality pattern. All vector databases live alongside doc-indexer and other riff databases.

## Endpoints

- REST API: <http://localhost:6333>
- gRPC API: <http://localhost:6334> (optional)
- Dashboard: <http://localhost:6333/dashboard>

## Health Check

```bash
curl http://localhost:6333/health
```

## Resource Usage

- Memory: ~100-500MB (depending on collection size)
- Disk: Variable (depends on indexed documents)

## Troubleshooting

**Port already in use:**

```bash
# Check what's using port 6333
lsof -i :6333

# Stop existing Qdrant
docker compose down
```

**Permission issues with volume:**

```bash
# Ensure directory exists and has correct permissions
mkdir -p ../../../.aria/db/vector-indexer
chmod 755 ../../../.aria/db/vector-indexer
```

## Alternative: Qdrant Standalone Binary

If you prefer to avoid Docker, Qdrant offers standalone binaries that can be configured to use the same `.aria/db/vector-indexer/` directory. See Qdrant documentation for platform-specific downloads.
