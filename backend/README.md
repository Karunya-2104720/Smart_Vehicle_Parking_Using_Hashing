# Smart Parking Management System – Backend

Educational Node.js & Express REST API backend powering the **Smart Parking Management System** web application.

The core data structures are implemented **manually on raw arrays** without using built-in `Map`, `Set`, or dictionary abstractions to provide maximum pedagogical clarity.

---

## 🚀 Quick Start

### 1. Install Dependencies
```bash
cd backend
npm install
```

### 2. Configure Environment
Copy `.env.example` to `.env` (already created by default):
```ini
PORT=5000
TABLE_SIZE=70
SECONDARY_PRIME=67
FRONTEND_URL=http://localhost:3000
```

### 3. Run the Server
```bash
# Production mode
npm start

# Development mode (with file watcher)
npm run dev
```

The API will start at:
```text
http://localhost:5000
```

### 4. Run Automated Algorithm Tests
```bash
npm test
```

### 5. Run the Research Benchmarks
```bash
# Fast smoke-sized experiment; writes CSV measurements and an SVG graph.
npm run benchmark:quick

# Larger experiment (includes capacities up to 100,000 and multiple workloads).
npm run benchmark
```

Benchmark artifacts are written under `backend/benchmarks/results/`. The benchmark
is independent of the interactive website and does not read or modify the saved
parking state. Each CSV row records the deterministic seed, workload, hash and
probe methods, fixed/adaptive policy, requested and final capacities, probe
counts, collisions, rehash/cleanup counts, Node.js version, platform, architecture,
and measured operation times. Workloads include randomized plates, shared plate
components, burst arrivals, and a mixed insert/search/delete sequence. The SVG
plots average unsuccessful-search probes;
the benchmark CSV is the source for exact operation values. A separate slot
distribution CSV records per-bucket occupancy histograms and collision counts
for both hash functions across the same workload families.

---

## 🧱 Architectural Structure

```text
backend/
├── server.js                 # Express server configuration & route mounting
├── package.json              # Dependencies and run scripts
├── .env                      # Environment variables
├── API.md                    # Detailed REST API specification
│
├── algorithms/               # Hashing algorithms and table engines
│   ├── hashTable.js          # Raw array-based 70-slot table engine
│   ├── linearProbing.js      # Linear probing formula & sequence generator
│   ├── quadraticProbing.js   # Quadratic increments formula (i^2)
│   ├── doubleHashing.js      # Dual hash functions h1 & h2
│   └── researchHashTable.js  # Adaptive research table, separate from fixed UI table
│
├── models/
│   ├── car.js                # Car entity & license plate key extraction
│   └── vehicleRegistration.js # Plate normalization and plate-aware polynomial hash
│
├── controllers/
│   └── parkingController.js  # HTTP request handling & status code mapping
│
├── routes/
│   └── parkingRoutes.js      # Express REST router
│
├── services/
│   ├── parkingService.js     # Business orchestration & algorithms explanation
│   └── persistenceService.js # JSON file storage manager
│
├── data/
│   └── parkingData.json      # Persistent table state
│
├── tests/
│   ├── hashing.test.js       # Existing interactive-table tests
│   └── researchHashTable.test.js
└── benchmarks/
    ├── runBenchmarks.js       # Repeatable workload runner
    └── results/               # Generated measurement, distribution, and SVG files
```

---

## 🧮 Hashing Specifications (7 Decks, 70 Slots)

- **Table Size ($M$)**: $70$, arranged as seven decks of ten slots (numbered **0 to 69**).
- **Key Extraction**: Extracts the numeric suffix (e.g. `TN 09 AB 1021` $\to$ `1021`).
- **Primary Hash Function**:
  $$h_1(key) = key \pmod{70}$$
- **Secondary Hash Function**:
  $$h_2(key) = \text{a key-dependent non-zero step co-prime to } 70$$
  *The step is adjusted when needed so double hashing can traverse every slot.*
- **Open Addressing & Tombstones**:
  Deleted cars leave a `TOMBSTONE` marker so that probe chains are not prematurely broken.

## Research implementation

The website continues to use its fixed 70-slot table so existing slot numbers
and visualizations remain stable. The experimental table in
`algorithms/researchHashTable.js` is separate and can be configured with:

- **Registration normalization**: uppercases and removes whitespace/hyphens;
  other punctuation, missing digits, and unsafe numeric suffixes are rejected.
  It accepts generic alphanumeric plate-like identifiers rather than enforcing
  a country-specific registration grammar. Vehicle identity uses the entire
  normalized plate, not just its numeric suffix.
- **Hash modes**: `division` is the existing numeric-suffix remainder baseline;
  `plate` uses the polynomial recurrence
  `h = (31 * h + characterCode) mod capacity` over every normalized character.
- **Collision handling**: linear probing, quadratic probing, or double hashing.
  Double hashing derives a nonzero step coprime with the current capacity.
- **Resizing**: optional doubling before the next insertion would exceed the
  configured active-entry load factor (0.70 by default). Rehashing places active
  records into a new table, so their slot indices may change.
- **Deletion**: deletions mark tombstones; searches continue through tombstones
  and insertion checks for duplicates before reusing them. Optional cleanup
  rebuilds the table when tombstones reach 20% of capacity. Growth is based on
  active entries; tombstones are handled by cleanup rather than included in the
  load-factor calculation.

The research table is a configurable experiment module, not yet an interactive
website setting. The current UI and API stay fixed-size. Benchmark results are
machine-dependent; probe counts are the more reproducible algorithmic metric.
The quick benchmark is a smoke-sized sample. Use the full run and preserve its
CSV, Node.js version, seed, and machine details before drawing research claims.
Quadratic probing can visit only part of some table capacities; failed inserts
are represented as failures rather than being treated as evidence of a full
table. Do not claim the plate hash is novel or faster without a literature
review and repeatable measurements.

---

## Publish as a Website

The repository includes a Render Blueprint at `render.yaml`. It deploys the frontend and API together, so the public website and API use the same origin. Render assigns a public `onrender.com` URL; a custom domain is optional.

1. Create a GitHub repository and upload this project, including `render.yaml`.
2. In Render, choose **New > Blueprint** and connect the GitHub repository.
3. Deploy the `smart-parking-hashing` web service from the Blueprint.
4. Open the public URL shown by Render. The health endpoint is `/api/health`.

The free service uses an ephemeral filesystem. Parking data saved to the JSON file can reset after a restart or redeploy; use persistent storage before relying on it for long-term data. This is an educational demo API and has no user authentication, so do not store sensitive information or treat it as a private parking system.
