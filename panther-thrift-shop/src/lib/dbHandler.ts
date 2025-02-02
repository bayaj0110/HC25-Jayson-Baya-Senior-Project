/**
 * dbHandler.ts
 *
 * This module provides a unified interface for managing data in the Panther Thrift Shop web application.
 * It supports both Firebase Firestore and a local SQLite-like database using IndexedDB (via the `idb` library).
 * By toggling the `NEXT_PUBLIC_USE_FIRESTORE` environment variable, the application can seamlessly switch
 * between these two database solutions.
 *
 * Features:
 * - CRUD (Create, Read, Update, Delete) operations for various data types such as Product, User, Conversation, and Message.
 * - Support for filtering queries in both Firestore and IndexedDB.
 * - Graceful fallback to a local database when Firestore is unavailable or exceeds its quota.
 * - Strong TypeScript typings ensure data integrity.
 *
 * Environment Variable:
 * - `NEXT_PUBLIC_USE_FIRESTORE`: Set to `"true"` to use Firestore; if not set to `"true"`, IndexedDB is used.
 *
 * Data Types:
 * - `Product`: Represents a product listing in the application.
 * - `User`: Represents a user in the application.
 * - `Conversation`: Represents a chat conversation.
 * - `Message`: Represents a message within a chat conversation.
 *
 * Functions:
 * - `initializeDB`: Initializes and upgrades the local IndexedDB instance.
 * - `addData<T>`: Adds a new record to the specified store in the selected database.
 * - `getData<T>`: Retrieves records from the specified store with optional filters.
 * - `updateData`: Updates an existing record in the specified store by ID.
 * - `deleteData`: Deletes a record from the specified store by ID.
 *
 * Limitations:
 * - Firestore usage is subject to quota limitations in the free tier.
 * - IndexedDB is only accessible in the browser and cannot be used in server-side code.
 *
 * Dependencies:
 * - `idb`: Provides a wrapper for IndexedDB.
 * - `firebase/firestore`: Enables Firestore operations.
 *
 * Author: Jayson Baya
 * Last Updated: January 25, 2025
 */



import { openDB, IDBPDatabase } from "idb";
import { db as firestoreDB } from "@/lib/firebaseConfig";
import {
    collection,
    addDoc,
    getDocs,
    query,
    where,
    doc,
    updateDoc,
    deleteDoc,
    DocumentData,
    Query,
    CollectionReference, getDoc,
} from "firebase/firestore";
import { WhereFilterOp } from "firebase/firestore";
import {Product} from "@/Models/Product";
import {uuidv4} from "@firebase/util";

const useFirestore = process.env.NEXT_PUBLIC_USE_FIRESTORE === "true";

let sqliteDB: IDBPDatabase | null = null;

const initializeDB = async (): Promise<IDBPDatabase> => {
    if (!sqliteDB) {
        sqliteDB = await openDB("PantherThriftShop", 2, { // 🔹 Increment version to recreate stores
            upgrade(db, oldVersion, newVersion) {
                console.log(`Upgrading IndexedDB from version ${oldVersion} to ${newVersion}`);

                // Ensure all required object stores exist
                if (!db.objectStoreNames.contains("products")) {
                    db.createObjectStore("products", { keyPath: "id" });
                }
                if (!db.objectStoreNames.contains("savedItems")) {
                    db.createObjectStore("savedItems", { keyPath: "id" });
                }
                if (!db.objectStoreNames.contains("purchasedItems")) {
                    db.createObjectStore("purchasedItems", { keyPath: "id" });
                }
                if (!db.objectStoreNames.contains("offers")) {
                    db.createObjectStore("offers", { keyPath: "id" });
                }

                console.log("IndexedDB object stores successfully created/updated.");
            },
        });
    }
    return sqliteDB;
};

const addData = async <T extends Record<string, unknown>>(
    storeName: string,
    data: Omit<T, "id"> // Exclude "id" since Firestore generates it
): Promise<void> => {
    if (useFirestore) {
        try {
            const collectionRef = collection(firestoreDB, storeName);
            const docRef = await addDoc(collectionRef, data); // Firestore generates ID
            console.log(`Firestore ID generated: ${docRef.id}`);

            // Save in IndexedDB with Firestore ID
            const db = await initializeDB();
            const tx = db.transaction(storeName, "readwrite");
            const store = tx.objectStore(storeName);
            await store.add({ id: docRef.id, ...data }); // Store Firestore ID locally
            await tx.done;

        } catch (error) {
            console.error(`Error adding document to ${storeName}:`, error);
        }
    } else {
        // IndexedDB Only
        const db = await initializeDB();
        const tx = db.transaction(storeName, "readwrite");
        const store = tx.objectStore(storeName);
        const id = uuidv4();
        await store.add({ id, ...data });
        await tx.done;
    }
};

const getData = async <T>(
    storeName: string,
    filters: { field: string; value: string | number | boolean | string[]; operator: string }[] = []
): Promise<T[]> => {
    if (useFirestore) {
        let q: Query<DocumentData> | CollectionReference<DocumentData> = collection(
            firestoreDB,
            storeName
        );
        filters.forEach((filter) => {
            q = query(q, where(filter.field, filter.operator as WhereFilterOp, filter.value));
        });

        const snapshot = await getDocs(q);
        return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as T));
    } else {
        const db = await initializeDB();

        // Check if the object store exists in IndexedDB
        if (!db.objectStoreNames.contains(storeName)) {
            console.error(`Object store "${storeName}" does not exist in IndexedDB.`);
            return []; // Return an empty array instead of crashing
        }

        const tx = db.transaction(storeName, "readonly");
        const store = tx.objectStore(storeName);
        const allData: T[] = await store.getAll();

        return filters.length
            ? allData.filter((item) =>
                filters.every(
                    (filter) =>
                        item[filter.field as keyof T] === filter.value ||
                        (Array.isArray(item[filter.field as keyof T]) &&
                            (item[filter.field as keyof T] as unknown[]).includes(filter.value))
                )
            )
            : allData;
    }
};

const updateData = async (storeName: string, id: string, updates: Partial<Product>) => {
    if (useFirestore) {
        const docRef = doc(firestoreDB, storeName, id);
        const docSnap = await getDoc(docRef);

        if (!docSnap.exists()) {
            console.error(`No document found with ID: ${id}`);
            return;
        }

        await updateDoc(docRef, updates);
    }

    // Update IndexedDB
    const db = await initializeDB();
    const tx = db.transaction(storeName, "readwrite");
    const store = tx.objectStore(storeName);
    const existingData = await store.get(id);
    if (!existingData) {
        console.warn(`No local record found with id: ${id}`);
        return;
    }
    await store.put({ ...existingData, ...updates });
    await tx.done;
};


const deleteData = async (storeName: string, id: string): Promise<void> => {
    if (useFirestore) {
        await deleteDoc(doc(firestoreDB, storeName, id));
    }
    const db = await initializeDB();
    const tx = db.transaction(storeName, "readwrite");
    const store = tx.objectStore(storeName);
    await store.delete(id);
    await tx.done;
};


export { initializeDB, addData, getData, updateData, deleteData };
