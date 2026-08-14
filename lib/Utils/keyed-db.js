/**
 * Minimal KeyedDB replacement for the archived @adiwajshing/keyed-db package.
 *
 * Implements only the API surface used by lib/Store/make-in-memory-store.js:
 *   - constructor(keyFn, idFn)  — keyFn can be a function or { key, compare } object
 *   - clear()                    — remove all items
 *   - get(id)                    — get item by id
 *   - upsert(...items)           — insert or update items
 *   - insertIfAbsent(...items)   — insert items only if their id doesn't exist; returns inserted items
 *   - update(id, updateFn)       — update item by id using a function
 *   - delete(item)               — remove by item reference
 *   - deleteById(id)             — remove by id
 *   - filter(predicate)          — returns a filtered collection with .all()
 *   - toJSON()                   — returns array of items for serialization
 *   - iterable                   — for...of support
 *
 * The original @adiwajshing/keyed-db maintained a sorted array keyed by a
 * comparison function. This implementation uses a Map for O(1) id lookups
 * and a sorted array maintained via the key/compare functions.
 */
export class KeyedDB {
    constructor(keyFn, idFn) {
        // keyFn can be either a plain function or an object { key, compare }
        if (typeof keyFn === 'function') {
            this._getKey = keyFn;
            this._compare = null;
        } else {
            this._getKey = keyFn?.key ?? ((item) => item);
            this._compare = keyFn?.compare ?? null;
        }
        this._idFn = idFn;
        this._items = new Map(); // id → item
        this._sorted = []; // sorted array of items
        this._dirty = false;
    }

    _rebuild() {
        if (!this._dirty) return;
        this._sorted = Array.from(this._items.values());
        if (this._compare) {
            // Use the provided compare function
            this._sorted.sort(this._compare);
        } else {
            // Fallback: sort by key string comparison
            this._sorted.sort((a, b) => String(this._getKey(a)).localeCompare(String(this._getKey(b))));
        }
        this._dirty = false;
    }

    clear() {
        this._items.clear();
        this._sorted = [];
        this._dirty = false;
    }

    get(id) {
        return this._items.get(id);
    }

    upsert(...items) {
        for (const item of items) {
            const id = this._idFn(item);
            this._items.set(id, item);
        }
        this._dirty = true;
    }

    insertIfAbsent(...items) {
        const inserted = [];
        for (const item of items) {
            const id = this._idFn(item);
            if (!this._items.has(id)) {
                this._items.set(id, item);
                inserted.push(item);
            }
        }
        if (inserted.length) this._dirty = true;
        return inserted;
    }

    update(id, updateFn) {
        const existing = this._items.get(id);
        if (!existing) return null;
        const updated = updateFn(existing);
        // If updateFn returns a new value, replace; otherwise it mutated in place
        if (updated !== undefined && updated !== existing) {
            this._items.set(id, updated);
        }
        this._dirty = true;
        return updated ?? existing;
    }

    delete(item) {
        const id = this._idFn(item);
        this._items.delete(id);
        this._dirty = true;
    }

    deleteById(id) {
        this._items.delete(id);
        this._dirty = true;
    }

    filter(predicate) {
        const results = [];
        for (const item of this._items.values()) {
            if (predicate(item)) results.push(item);
        }
        return {
            all: () => results,
        };
    }

    toJSON() {
        return Array.from(this._items.values());
    }

    get length() {
        return this._items.size;
    }

    [Symbol.iterator]() {
        this._rebuild();
        return this._sorted[Symbol.iterator]();
    }
}
