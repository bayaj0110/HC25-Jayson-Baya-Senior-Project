/**
 * BuyingPage.tsx
 *
 * This file defines the `BuyingPage` component for the Panther Thrift Shop web application.
 * The `BuyingPage` serves as the main dashboard for buyers, allowing them to:
 * - View their saved items.
 * - Check their purchase history.
 * - View offers they have made on products.
 *
 * The component fetches data in real-time from Firebase Firestore and organizes it into three tabs:
 * "Saved Items", "Purchased Orders", and "Offers". Buyers can easily navigate between these tabs to
 * manage their items and track their activities.
 * Model, This ensures that all product data fetched from Firestore follows a consistent structure,
 * making it easier to handle and display.
 *
 * Key Features:
 * - Real-time data fetching for saved items, purchased items, and offers using Firebase Firestore.
 * - User authentication via Firebase Auth with redirection to login if the user is not authenticated.
 * - Responsive UI with tab-based navigation.
 * - Displays detailed information for each item, including product image, name, price, and description.
 *
 * Dependencies:
 * - Firebase Auth for user authentication.
 * - Firebase Firestore for data retrieval.
 * - `MarketplaceNavBar` and `MarketplaceSidebar` components for navigation.
 *
 * Author: Jayson Baya
 * Last Updated: November 14, 2024
 */

"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebaseConfig";
import { getData } from "@/lib/dbHandler"; // Import the dbHandler function
import {
    FIRESTORE_COLLECTIONS,
    FIRESTORE_FIELDS,
    renderTabContentMessage,
    ROUTES,
} from "@/Models/ConstantData";
import { TAB_NAMES } from "@/Models/ConstantData";
import ProductGrid from "@/components/ProductGrid";
import { Product } from "@/Models/Product";

const BuyingPage = () => {
    const [savedItems, setSavedItems] = useState<Product[]>([]); // Saved items
    const [purchasedItems, setPurchasedItems] = useState<Product[]>([]); // Purchased items
    const [offers, setOffers] = useState<Product[]>([]); // Offers made
    const [selectedTab, setSelectedTab] = useState(TAB_NAMES.SAVED_ITEMS); // Active tab
    const router = useRouter();

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            if (user) {
                const email = user.email || "";

                try {
                    // Fetch saved items
                    const savedItemsData = await getData<Product>(FIRESTORE_COLLECTIONS.SAVED_ITEMS, [{
                        field: FIRESTORE_FIELDS.BUYER_EMAIL,
                        operator: "==",
                        value: email
                    }]);
                    setSavedItems(savedItemsData);

                    // Fetch purchased items
                    const purchasedItemsData = await getData<Product>(FIRESTORE_COLLECTIONS.PURCHASED_ITEMS, [{
                        field: FIRESTORE_FIELDS.BUYER_EMAIL,
                        operator: "==",
                        value: email
                    }]);
                    setPurchasedItems(purchasedItemsData);

                    // Fetch offers
                    const offersData = await getData<Product>(FIRESTORE_COLLECTIONS.OFFERS, [{
                        field: FIRESTORE_FIELDS.BUYER_EMAIL,
                        operator: "==",
                        value: email
                    }]);
                    setOffers(offersData);
                } catch (error) {
                    console.error("Error fetching data:", error);
                }
            } else {
                router.push(ROUTES.LOGIN); // Redirect to login if not authenticated
            }
        });

        return () => unsubscribe();
    }, [router]);

    // Render tab content based on the active tab
    const renderTabContent = () => {
        switch (selectedTab) {
            case TAB_NAMES.SAVED_ITEMS:
                return (
                    <ProductGrid
                        products={savedItems}
                        emptyMessage={renderTabContentMessage.emptySaved}
                    />
                );
            case TAB_NAMES.PURCHASED_ORDERS:
                return (
                    <ProductGrid
                        products={purchasedItems}
                        emptyMessage={renderTabContentMessage.emptyPurchased}
                    />
                );
            case TAB_NAMES.OFFERS:
                return (
                    <ProductGrid
                        products={offers}
                        emptyMessage={renderTabContentMessage.emptyOffers}
                    />
                );
            default:
                return null;
        }
    };

    return (
        <div className="min-h-screen flex flex-col">
            <div className="flex flex-grow">
                <div className="flex-grow p-6">
                    <h1 className="text-2xl font-bold mb-6">My Buying Page</h1>

                    {/* Tabs */}
                    <div className="mb-4">
                        {Object.values(TAB_NAMES).map((tabName) => (
                            <button
                                key={tabName}
                                onClick={() => setSelectedTab(tabName)}
                                className={`px-4 py-2 ${
                                    selectedTab === tabName
                                        ? "bg-blue-500 text-white"
                                        : "bg-gray-200"
                                }`}
                            >
                                {tabName}
                            </button>
                        ))}
                    </div>

                    {/* Render Content */}
                    {renderTabContent()}
                </div>
            </div>
        </div>
    );
};

export default BuyingPage;
