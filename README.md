# Smart Parking Management System Using Hashing

A web-based smart parking management system designed to demonstrate and visualize the practical implementation of hashing data structures.

The system manages **48 parking slots** and uses a vehicle's registration number as the key for hashing. It demonstrates how hash functions, collision resolution, searching, deletion, and load factor work through an interactive parking scenario.

The primary objective of this project is to understand hashing by implementing the underlying algorithms rather than treating hashing as a black-box data structure.

---

## Project Overview

In a traditional parking system, finding an available parking slot or locating a parked vehicle can require checking multiple slots.

This project models the parking area as a **hash table** containing 48 slots, numbered from `0` to `47`.

Each vehicle registration number is converted into a numeric key. The key is then passed through a hash function to determine the vehicle's initial parking slot.

For example:

```text
Registration Number: TN 09 AB 1021
Numeric Key: 1021
```

The hash function is:

```text
hash(key) = key % 48
```

Therefore:

```text
1021 % 48 = 13
```

The system initially attempts to place the vehicle in **Slot 13**.

If Slot 13 is already occupied, a collision occurs. The system then uses the selected collision-resolution technique to find another available slot.

---

## Hashing Techniques

The project demonstrates multiple collision-resolution techniques.

### 1. Hash Function

The primary hash function is:

```text
h(key) = key % tableSize
```

Since the parking area contains 48 slots:

```text
tableSize = 48
```

Example:

```text
Key = 1021

h(1021) = 1021 % 48
        = 13
```

The resulting value represents the initial slot selected for the vehicle.

---

### 2. Linear Probing

When the calculated slot is occupied, Linear Probing checks the next slots sequentially.

The formula is:

```text
index = (hash(key) + i) % tableSize
```

where `i` represents the number of attempts.

For example, if the initial hash index is `13`:

```text
Slot 13 → Occupied
Slot 14 → Occupied
Slot 15 → Available
```

The vehicle is then assigned to Slot 15.

Linear Probing is simple to implement, but consecutive occupied slots can result in clustering.

---

### 3. Quadratic Probing

Quadratic Probing changes the position checked after each collision using a quadratic function.

The formula is:

```text
index = (hash(key) + i²) % tableSize
```

The probing sequence increases according to the square of the attempt number.

For example:

```text
i = 0 → h(key)
i = 1 → h(key) + 1²
i = 2 → h(key) + 2²
i = 3 → h(key) + 3²
```

This reduces some of the clustering associated with Linear Probing.

---

### 4. Double Hashing

Double Hashing uses a second hash function to determine the probing interval.

Primary hash function:

```text
h1(key) = key % 48
```

Secondary hash function:

```text
h2(key) = 7 - (key % 7)
```

The final index is calculated using:

```text
index = (h1(key) + i × h2(key)) % 48
```

Using two hash functions provides a different probing sequence for different keys and can reduce clustering.

---

# Parking Operations

The system supports the following operations.

## Park a Vehicle

When a vehicle is parked:

```text
Registration Number
        |
        v
Extract Numeric Key
        |
        v
Calculate Hash Index
        |
        v
Check Parking Slot
        |
        +------------------+
        |                  |
        v                  v
    Available           Occupied
        |                  |
        v                  v
   Park Vehicle       Collision
                           |
                           v
                 Apply Probing Method
                           |
                           v
                  Find Available Slot
                           |
                           v
                      Park Vehicle
```

The system records the hashing process and the probing sequence used to find the final slot.

---

## Search for a Vehicle

The system can locate a parked vehicle using its registration number.

The search process is:

```text
Registration Number
        |
        v
Extract Numeric Key
        |
        v
Calculate Hash Index
        |
        v
Check Initial Slot
        |
        v
Apply Probing Sequence
        |
        v
Locate Vehicle
```

The system also records the number of slots checked during the search.

---

## Remove a Vehicle

A vehicle can be removed from the parking table using its registration number.

The system searches for the vehicle using the appropriate probing technique and removes it from the parking table.

For open-addressing techniques, deletion must be handled carefully so that removing an element does not break the search sequence for other vehicles.

---

# Collision Handling

A collision occurs when two different keys produce the same hash index.

For example:

```text
Key A % 48 = 13
Key B % 48 = 13
```

Both vehicles initially attempt to use Slot 13.

Since only one vehicle can occupy the slot, the second insertion produces a collision.

The system then uses the selected collision-resolution technique to find another location.

The application allows the probing process to be observed step by step.

---

# Load Factor

The load factor represents how full the hash table is.

It is calculated as:

```text
Load Factor = Number of Occupied Slots / Total Number of Slots
```

For example, if 24 out of 48 slots are occupied:

```text
Load Factor = 24 / 48
            = 0.5
            = 50%
```

As the load factor increases, the probability of collisions and additional probing can also increase.

---

# Parking Slot Visualization

The parking area contains 48 slots:

```text
0   1   2   3   4   5   6   7   8   9   10  11
12  13  14  15  16  17  18  19  20  21  22  23
24  25  26  27  28  29  30  31  32  33  34  35
36  37  38  39  40  41  42  43  44  45  46  47
```

Each slot represents one position in the hash table.

The interface displays whether a slot is available or occupied and provides information about the vehicle assigned to an occupied slot.

---

# What This Project Demonstrates

This project provides a practical implementation of the following data-structure concepts:

* Hash tables
* Hash functions
* Collision detection
* Linear Probing
* Quadratic Probing
* Double Hashing
* Open addressing
* Searching
* Deletion
* Load factor
* Probing sequences
* Hash-table visualization
* Algorithm comparison

The parking system provides a real-world analogy for understanding how hash tables store and locate data efficiently.

---

# Example

Consider the following vehicle:

```text
Registration Number:
TN 09 AB 1021
```

The numeric key is:

```text
1021
```

The initial hash index is:

```text
1021 % 48 = 13
```

Therefore, the system first checks:

```text
Slot 13
```

If Slot 13 is available:

```text
Vehicle → Slot 13
```

If Slot 13 is occupied and Linear Probing is selected:

```text
Slot 13 → Occupied
Slot 14 → Occupied
Slot 15 → Available
```

The vehicle is assigned to:

```text
Slot 15
```

The same input can produce a different probing sequence when Quadratic Probing or Double Hashing is selected.

---

# Why This Project Was Built

Hashing is often introduced as a theoretical data structure involving keys, hash functions, and collisions.

This project was developed to understand those concepts through a practical application.

Instead of simply storing vehicles in a conventional collection, the parking slots themselves represent the hash table. Every parking operation demonstrates what happens internally when data is inserted, searched, or removed.

This makes it possible to observe the relationship between:

```text
Key
 ↓
Hash Function
 ↓
Hash Index
 ↓
Collision
 ↓
Collision Resolution
 ↓
Final Position
```

---

# Learning Outcomes

Through this project, I gained practical understanding of:

* How a hash function maps a key to an index.
* Why multiple keys can produce the same hash index.
* How collisions are detected.
* How Linear Probing resolves collisions.
* How Quadratic Probing generates a different probing sequence.
* How Double Hashing uses a secondary hash function.
* How open addressing works.
* How searching works after collisions occur.
* Why deletion requires special handling in open-addressed hash tables.
* How load factor affects hash-table behavior.
* How data-structure algorithms can be integrated into a real-world application.

---

# Project Architecture

The application follows a frontend-backend architecture.

```text
                    User
                     |
                     v
                Frontend UI
                     |
                     | HTTP Requests
                     v
                Backend API
                     |
                     v
             Parking Management
                     |
                     v
              Hash Table Logic
                     |
        +------------+------------+
        |            |            |
        v            v            v
   Linear        Quadratic     Double
   Probing        Probing      Hashing
        |            |            |
        +------------+------------+
                     |
                     v
              Parking Slots
                 0 - 47
```

The hashing logic is separated from the API layer so that the underlying algorithms can be implemented and understood independently.

---

# Technologies

The project is built using web technologies and a backend API.

* HTML
* CSS
* JavaScript
* Node.js
* Express.js
* REST API

The exact implementation and dependencies can be found in the project source code.

---

# API Operations

The backend provides API operations for managing the parking system.

Typical operations include:

```text
POST   /api/parking/park
GET    /api/parking/search/:registrationNumber
DELETE /api/parking/delete/:registrationNumber
GET    /api/parking
GET    /api/parking/statistics
POST   /api/parking/reset
POST   /api/parking/compare
```

These APIs allow the frontend to communicate with the hashing implementation and retrieve the results of parking, searching, deletion, and algorithm-comparison operations.

---

# Complexity

For a hash table with a suitable load factor, insertion and search can have average-case constant-time complexity.

| Operation | Average Case | Worst Case |
| --------- | ------------ | ---------- |
| Insertion | O(1)         | O(n)       |
| Search    | O(1)         | O(n)       |
| Deletion  | O(1)         | O(n)       |

The worst-case behavior can occur when many collisions happen and the system needs to examine multiple slots.

Performance is influenced by the load factor and the distribution of keys.

---

# Future Improvements

Possible future improvements include:

* Dynamic parking capacity
* Additional collision-resolution techniques
* Separate Chaining
* Performance benchmarking with larger datasets
* Database integration
* User authentication
* Multiple parking areas
* Real-time parking availability
* Parking history
* Reservation functionality
* Advanced analytics

---

# Conclusion

The Smart Parking Management System demonstrates how hashing can be applied to a practical problem.

By representing 48 parking slots as a hash table, the project provides a clear way to understand hash functions, collisions, probing techniques, searching, deletion, and load factor.

The main focus of the project is not only managing parking slots, but understanding how hashing works internally and how different collision-resolution techniques affect the way data is stored and retrieved.

