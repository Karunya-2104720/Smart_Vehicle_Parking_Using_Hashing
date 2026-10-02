# Smart Parking Hashing System – REST API Documentation

The Smart Parking Backend exposes RESTful endpoints for managing an array-based hash table of **47 parking slots** (slots numbered **0 to 46**).

**Base URL**: `http://localhost:5000`

---

## 1. Park a Car
Inserts a car into the parking lot using the selected collision-resolution technique.

- **Method**: `POST`
- **URL**: `/api/parking/park`
- **Headers**: `Content-Type: application/json`

### Request Body
```json
{
  "registrationNumber": "TN 09 AB 1021",
  "method": "linear",
  "color": "#3b82f6"
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| `registrationNumber` | String | Yes | Vehicle plate (e.g. `"TN 09 AB 1021"`). Numeric key will be extracted. |
| `method` | String | No | Collision method: `"basic"`, `"linear"`, `"quadratic"`, or `"double"`. Default is `"linear"`. |
| `color` | String | No | Optional hex color for UI visualization. |

### Successful Response (`201 Created`)
```json
{
  "success": true,
  "statusCode": 201,
  "message": "Car parked successfully",
  "car": {
    "registrationNumber": "TN 09 AB 1021",
    "key": 1021,
    "color": "#3b82f6"
  },
  "hashIndex": 34,
  "finalSlot": 34,
  "method": "linear",
  "collision": false,
  "collisionCount": 0,
  "probes": 1,
  "steps": [
    {
      "attempt": 1,
      "probeStep": 0,
      "index": 34,
      "formula": "(34 + 0) % 47 = 34",
      "status": "AVAILABLE"
    }
  ]
}
```

### Collision Handled Response (`201 Created`)
```json
{
  "success": true,
  "statusCode": 201,
  "message": "Car parked successfully",
  "car": {
    "registrationNumber": "KA 05 MN 1068",
    "key": 1068,
    "color": "#ef4444"
  },
  "hashIndex": 34,
  "finalSlot": 35,
  "method": "linear",
  "collision": true,
  "collisionCount": 1,
  "probes": 2,
  "steps": [
    {
      "attempt": 1,
      "probeStep": 0,
      "index": 34,
      "formula": "(34 + 0) % 47 = 34",
      "status": "OCCUPIED",
      "occupiedBy": "TN 09 AB 1021",
      "occupiedKey": 1021
    },
    {
      "attempt": 2,
      "probeStep": 1,
      "index": 35,
      "formula": "(34 + 1) % 47 = 35",
      "status": "AVAILABLE"
    }
  ]
}
```

### Error Responses
- `400 Bad Request`: Invalid or missing registration number / unsupported method.
- `409 Conflict`: Car already parked, or parking lot full (47/47 capacity).

---

## 2. Search for a Car
Locates a car by registration number, tracing every slot probed.

- **Method**: `GET`
- **URL**: `/api/parking/search/:registrationNumber`
- **Query Parameters**:
  - `method` (optional): Hashing method used (`"linear"`, `"quadratic"`, `"double"`, `"basic"`). Default is `"linear"`.

### Successful Response (`200 OK`)
```json
{
  "found": true,
  "statusCode": 200,
  "registrationNumber": "TN 09 AB 1021",
  "key": 1021,
  "hashIndex": 34,
  "foundAt": 34,
  "probes": 1,
  "steps": [
    {
      "attempt": 1,
      "index": 34,
      "formula": "(34 + 0) % 47 = 34",
      "status": "OCCUPIED",
      "match": true,
      "carRegistration": "TN 09 AB 1021",
      "carKey": 1021
    }
  ]
}
```

### Not Found Response (`404 Not Found`)
```json
{
  "found": false,
  "statusCode": 404,
  "error": "Car not found.",
  "registrationNumber": "DL 01 AA 9999",
  "key": 9999,
  "hashIndex": 35,
  "probes": 1,
  "steps": [
    {
      "attempt": 1,
      "index": 35,
      "formula": "(35 + 0) % 47 = 35",
      "status": "EMPTY",
      "match": false
    }
  ]
}
```

---

## 3. Delete a Car (Tombstone Marker)
Removes a parked car and leaves a `TOMBSTONE` marker in its slot to preserve search chains.

- **Method**: `DELETE`
- **URL**: `/api/parking/delete/:registrationNumber`
- **Query Parameters**:
  - `method` (optional): Probing method. Default is `"linear"`.

### Response (`200 OK`)
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Car removed successfully",
  "registrationNumber": "TN 09 AB 1021",
  "deletedSlot": 34,
  "probes": 1,
  "steps": [...]
}
```

---

## 4. Get Parking Lot Status
Returns the state of all 47 slots (indices 0 to 46).

- **Method**: `GET`
- **URL**: `/api/parking`

### Response (`200 OK`)
```json
{
  "tableSize": 47,
  "slots": [
    {
      "index": 0,
      "status": "EMPTY",
      "car": null
    },
    {
      "index": 34,
      "status": "OCCUPIED",
      "car": {
        "registrationNumber": "TN 09 AB 1021",
        "key": 1021,
        "hashIndex": 34,
        "color": "#3b82f6",
        "probesNeeded": 1,
        "methodUsed": "linear",
        "parkedAt": "2026-10-01T14:45:00.000Z"
      }
    },
    {
      "index": 35,
      "status": "TOMBSTONE",
      "car": null,
      "tombstoneInfo": {
        "previousRegistration": "KA 05 MN 1068",
        "previousKey": 1068
      }
    }
  ]
}
```

---

## 5. Get Statistics
Returns live metrics, occupancy, and load factor.

- **Method**: `GET`
- **URL**: `/api/parking/statistics`

### Response (`200 OK`)
```json
{
  "totalSlots": 47,
  "occupiedSlots": 12,
  "availableSlots": 35,
  "loadFactor": 0.2553,
  "loadFactorPercentage": 25.53,
  "totalCollisions": 3,
  "totalProbes": 16,
  "totalSearches": 5,
  "successfulSearches": 4,
  "failedSearches": 1
}
```

---

## 6. Reset Parking Lot
Empties all slots, clears tombstones, and resets all counters.

- **Method**: `POST`
- **URL**: `/api/parking/reset`

### Response (`200 OK`)
```json
{
  "success": true,
  "message": "Parking lot successfully reset to empty state.",
  "table": {
    "tableSize": 47,
    "slots": [...]
  }
}
```

---

## 7. Simulate Batch Insertions (Collision Lab)
Simulates batch arrivals on an isolated table without mutating real parking lot data.

- **Method**: `POST`
- **URL**: `/api/parking/simulate`
- **Request Body**:
```json
{
  "registrationNumbers": [
    "CAR-15",
    "CAR-62",
    "CAR-109"
  ],
  "method": "linear"
}
```

### Response (`200 OK`)
```json
{
  "method": "linear",
  "tableSize": 47,
  "results": [
    {
      "registrationNumber": "CAR-15",
      "key": 15,
      "hashIndex": 15,
      "finalIndex": 15,
      "collision": false,
      "steps": [...]
    },
    {
      "registrationNumber": "CAR-62",
      "key": 62,
      "hashIndex": 15,
      "finalIndex": 16,
      "collision": true,
      "steps": [...]
    }
  ],
  "statistics": {
    "collisions": 1,
    "probes": 3
  }
}
```

---

## 8. Compare All Algorithms
Simultaneously runs the same batch against Basic Hashing, Linear Probing, Quadratic Probing, and Double Hashing.

- **Method**: `POST`
- **URL**: `/api/parking/compare`
- **Request Body**:
```json
{
  "registrationNumbers": [
    "TN 09 AB 1021",
    "KA 01 MN 1068",
    "MH 12 CD 1115"
  ]
}
```

### Response (`200 OK`)
```json
{
  "tableSize": 47,
  "comparison": {
    "basic": { "collisions": 2, "probes": 3, "results": [...] },
    "linear": { "collisions": 2, "probes": 5, "results": [...] },
    "quadratic": { "collisions": 2, "probes": 5, "results": [...] },
    "double": { "collisions": 2, "probes": 4, "results": [...] }
  }
}
```

---

## 9. Algorithm Educational Info
- **Method**: `GET`
- **URL**: `/api/algorithms/:method`
- Parameter: `basic`, `linear`, `quadratic`, or `double`.

### Response (`200 OK`)
```json
{
  "name": "Linear Probing",
  "formula": "index = (hash(key) + i) % 47",
  "description": "When a collision occurs, sequentially searches the next slot (i = 0, 1, 2, ...).",
  "clustering": "Primary Clustering (Consecutive occupied blocks tend to merge and grow larger)",
  "complexity": {
    "averageSearch": "O(1)",
    "worstCaseSearch": "O(n)"
  }
}
```
