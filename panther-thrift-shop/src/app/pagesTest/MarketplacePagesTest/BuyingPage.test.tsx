//  BuyingPage.test.tsx
import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { onAuthStateChanged } from "firebase/auth";
import { ROUTES } from "@/Models/ConstantData";
import { useRouter } from "next/navigation";
import { Product } from "@/Models/Product";
import { fetchFirestoreData } from "@/utils/fetchFirestoreData";
import BuyingPage from "@/app/pages/BuyingPage/page";

// Mock firebase/auth
jest.mock("firebase/auth", () => ({
    getAuth: jest.fn(() => ({ currentUser: null })),
    onAuthStateChanged: jest.fn(),
}));

jest.mock("next/navigation", () => ({
    useRouter: jest.fn(),
}));

jest.mock("@/utils/fetchFirestoreData", () => ({
    fetchFirestoreData: jest.fn(),
}));

const mockPush = jest.fn();

(useRouter as jest.Mock).mockReturnValue({
    push: mockPush,
});

describe("BuyingPage Component", () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test("redirects unauthenticated users to login", async () => {
        // Mock unauthenticated state
        (onAuthStateChanged as jest.Mock).mockImplementation((_auth, callback) => {
            callback(null); // Simulate unauthenticated user
            return jest.fn(); // Mock unsubscribe function
        });

        render(<BuyingPage />);

        // Assert redirection to login
        await waitFor(() => expect(mockPush).toHaveBeenCalledWith(ROUTES.LOGIN));
    });

    test("displays 'Saved Items' tab by default", async () => {
        const mockSavedItems: Product[] = [
            {
                id: "1",
                productName: "Saved Product",
                price: 20,
                category: "Category",
                imageURL: "",
                description: "",
                seller: "",
                sold: false,
                markAsSold: jest.fn(),
                updateDetails: jest.fn(),
                getSummary: jest.fn(() => "Saved Product - $20 (Category)"),
            },
        ];

        // Mock authenticated user
        (onAuthStateChanged as jest.Mock).mockImplementation((_auth, callback) => {
            callback({ email: "user@example.com" }); // Simulate authenticated user
            return jest.fn(); // Mock unsubscribe function
        });

        (fetchFirestoreData as jest.Mock)
            .mockResolvedValueOnce(mockSavedItems) // For saved items
            .mockResolvedValueOnce([]) // For purchased items
            .mockResolvedValueOnce([]); // For offers

        render(<BuyingPage />);

        await waitFor(() => expect(screen.getByText("Saved Product")).toBeInTheDocument());
    });

    test("shows empty message when no items are available", async () => {
        // Mock authenticated user
        (onAuthStateChanged as jest.Mock).mockImplementation((_auth, callback) => {
            callback({ email: "user@example.com" }); // Simulate authenticated user
            return jest.fn(); // Mock unsubscribe function
        });

        (fetchFirestoreData as jest.Mock)
            .mockResolvedValueOnce([]) // For saved items
            .mockResolvedValueOnce([]) // For purchased items
            .mockResolvedValueOnce([]); // For offers

        render(<BuyingPage />);

        await waitFor(() => expect(screen.getByText("No saved items yet.")).toBeInTheDocument());

        fireEvent.click(screen.getByText("Purchased Orders"));
        await waitFor(() => expect(screen.getByText("No purchased items yet.")).toBeInTheDocument());

        fireEvent.click(screen.getByText("Offers"));
        await waitFor(() => expect(screen.getByText("No offers made yet.")).toBeInTheDocument());
    });

    test("switches tabs correctly", async () => {
        const mockSavedItems = [
            { id: "1", productName: "Saved Product", price: 20, category: "", imageURL: "", description: "", seller: "", sold: false },
        ];
        const mockPurchasedItems = [
            { id: "2", productName: "Purchased Product", price: 50, category: "", imageURL: "", description: "", seller: "", sold: true },
        ];

        // Mock authenticated user
        (onAuthStateChanged as jest.Mock).mockImplementation((_auth, callback) => {
            callback({ email: "user@example.com" }); // Simulate authenticated user
            return jest.fn(); // Mock unsubscribe function
        });

        (fetchFirestoreData as jest.Mock)
            .mockResolvedValueOnce(mockSavedItems)
            .mockResolvedValueOnce(mockPurchasedItems)
            .mockResolvedValueOnce([]);

        render(<BuyingPage />);

        fireEvent.click(screen.getByText("Purchased Orders"));
        await waitFor(() => expect(screen.getByText("Purchased Product")).toBeInTheDocument());

        fireEvent.click(screen.getByText("Saved Items"));
        await waitFor(() => expect(screen.getByText("Saved Product")).toBeInTheDocument());
    });

    test("fetches data for all tabs", async () => {
        const mockSavedItems: Product[] = [
            {
                id: "1",
                productName: "Saved Product",
                price: 20,
                category: "Category",
                imageURL: "",
                description: "Saved product description",
                seller: "",
                sold: false,
                markAsSold: jest.fn(),
                updateDetails: jest.fn(),
                getSummary: jest.fn(() => "Saved Product - $20"),
            },
        ];

        const mockPurchasedItems: Product[] = [
            {
                id: "2",
                productName: "Purchased Product",
                price: 50,
                category: "Category",
                imageURL: "",
                description: "Purchased product description",
                seller: "",
                sold: true,
                markAsSold: jest.fn(),
                updateDetails: jest.fn(),
                getSummary: jest.fn(() => "Purchased Product - $50"),
            },
        ];

        // Mock authenticated user
        (onAuthStateChanged as jest.Mock).mockImplementation((_auth, callback) => {
            callback({ email: "user@example.com" }); // Simulate authenticated user
            return jest.fn(); // Mock unsubscribe function
        });

        (fetchFirestoreData as jest.Mock)
            .mockResolvedValueOnce(mockSavedItems) // For savedItems
            .mockResolvedValueOnce(mockPurchasedItems) // For purchasedItems
            .mockResolvedValueOnce([]); // For offers

        render(<BuyingPage />);

        await waitFor(() => expect(fetchFirestoreData).toHaveBeenCalledTimes(3));

        expect(fetchFirestoreData).toHaveBeenCalledWith("savedItems", "user@example.com", "buyerEmail");
        expect(fetchFirestoreData).toHaveBeenCalledWith("purchasedItems", "user@example.com", "buyerEmail");
        expect(fetchFirestoreData).toHaveBeenCalledWith("offers", "user@example.com", "buyerEmail");
    });
});
