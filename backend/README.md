# Smart Parking Slot Management System – Backend

Educational Node.js & Express REST API backend powering the **Smart Parking – Learn Hashing Through Parking** web application.

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
TABLE_SIZE=47
SECONDARY_PRIME=43
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

---

## 🧱 Architectural Structure

```text
backend/
├── server.js                 # Express server configuration & route mounting
├── package.json              # Dependencies and run scripts
├── .env                      # Environment variables
├── API.md                    # Detailed REST API specification
│
├── algorithms/               # Pure manual hashing algorithms
│   ├── hashTable.js          # Raw array-based 47-slot table engine
│   ├── linearProbing.js      # Linear probing formula & sequence generator
│   ├── quadraticProbing.js   # Quadratic increments formula (i^2)
│   └── doubleHashing.js      # Dual hash functions h1 & h2
│
├── models/
│   └── car.js                # Car entity & license plate key extraction
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
└── tests/
    └── hashing.test.js       # Unit test suite
```

---

## 🧮 Hashing Specifications (47 Slots)

- **Table Size ($M$)**: $47$ (Prime number in the 40–50 range, numbered **0 to 46**).
- **Key Extraction**: Extracts the numeric suffix (e.g. `TN 09 AB 1021` $\to$ `1021`).
- **Primary Hash Function**:
  $$h_1(key) = key \pmod{47}$$
- **Secondary Hash Function**:
  $$h_2(key) = 43 - (key \pmod{43})$$
  *Uses 43 (prime $< 47$), guaranteeing non-zero steps co-prime to 47 for full cycle traversal.*
- **Open Addressing & Tombstones**:
  Deleted cars leave a `TOMBSTONE` marker so that probe chains are not prematurely broken.

---

## Publish as a Website

The repository includes a Render Blueprint at `render.yaml`. It deploys the frontend and API together, so the public website and API use the same origin. Render assigns a public `onrender.com` URL; a custom domain is optional.

1. Create a GitHub repository and upload this project, including `render.yaml`.
2. In Render, choose **New > Blueprint** and connect the GitHub repository.
3. Deploy the `smart-parking-hashing` web service from the Blueprint.
4. Open the public URL shown by Render. The health endpoint is `/api/health`.

The free service uses an ephemeral filesystem. Parking data saved to the JSON file can reset after a restart or redeploy; use persistent storage before relying on it for long-term data. This is an educational demo API and has no user authentication, so do not store sensitive information or treat it as a private parking system.
