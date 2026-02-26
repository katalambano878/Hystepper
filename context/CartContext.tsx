'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';

export type CartItem = {
    id: string;
    name: string;
    price: number;
    image: string;
    quantity: number;
    variant?: string;
    slug: string;
    maxStock: number;
};

type CartContextType = {
    cart: CartItem[];
    addToCart: (item: CartItem) => void;
    removeFromCart: (itemId: string, variant?: string) => void;
    updateQuantity: (itemId: string, quantity: number, variant?: string) => void;
    clearCart: () => void;
    cartCount: number;
    subtotal: number;
    isCartOpen: boolean;
    setIsCartOpen: (isOpen: boolean) => void;
};

const CartContext = createContext<CartContextType | undefined>(undefined);

export function CartProvider({ children }: { children: ReactNode }) {
    const [cart, setCart] = useState<CartItem[]>([]);
    const [isCartOpen, setIsCartOpen] = useState(false);
    const [isInitialized, setIsInitialized] = useState(false);

    // Load cart from localStorage on mount
    useEffect(() => {
        const savedCart = localStorage.getItem('cart');
        if (savedCart) {
            try {
                setCart(JSON.parse(savedCart));
            } catch (e) {
                console.error('Failed to parse cart:', e);
            }
        }
        setIsInitialized(true);
    }, []);

    // Save cart to localStorage whenever it changes
    useEffect(() => {
        if (isInitialized) {
            localStorage.setItem('cart', JSON.stringify(cart));
            window.dispatchEvent(new Event('cartUpdated')); // Keep compatibility with legacy listeners if any
        }
    }, [cart, isInitialized]);

    const addToCart = (newItem: CartItem) => {
        setCart((prevCart) => {
            const existingItemIndex = prevCart.findIndex(
                (item) => item.id === newItem.id && item.variant === newItem.variant
            );

            if (existingItemIndex > -1) {
                const newCart = [...prevCart];
                const existingItem = newCart[existingItemIndex];
                const maxStock = Number(existingItem.maxStock);
                const cap = Number.isNaN(maxStock) || maxStock <= 0 ? 999 : maxStock;
                const newQuantity = Math.min(
                    existingItem.quantity + newItem.quantity,
                    cap
                );
                newCart[existingItemIndex] = { ...existingItem, quantity: newQuantity };
                return newCart;
            } else {
                const safeItem = {
                    ...newItem,
                    maxStock: (Number(newItem.maxStock) > 0 ? Number(newItem.maxStock) : 999),
                    price: Number(newItem.price) || 0,
                    quantity: Math.max(1, Number(newItem.quantity) || 1),
                    image: newItem.image ?? 'https://via.placeholder.com/400x400?text=Product'
                };
                return [...prevCart, safeItem];
            }
        });

        setIsCartOpen(true); // Open cart when item is added
    };

    const removeFromCart = (itemId: string, variant?: string) => {
        setCart((prevCart) =>
            prevCart.filter((item) => !(item.id === itemId && item.variant === variant))
        );
    };

    const updateQuantity = (itemId: string, quantity: number, variant?: string) => {
        if (quantity < 1) {
            removeFromCart(itemId, variant);
            return;
        }

        const cap = (item: CartItem) => (Number(item.maxStock) > 0 ? Number(item.maxStock) : 999);
        setCart((prevCart) =>
            prevCart.map((item) =>
                item.id === itemId && item.variant === variant
                    ? { ...item, quantity: Math.min(quantity, cap(item)) }
                    : item
            )
        );
    };

    const clearCart = () => {
        setCart([]);
    };

    const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);
    const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);

    return (
        <CartContext.Provider value={{
            cart,
            addToCart,
            removeFromCart,
            updateQuantity,
            clearCart,
            cartCount,
            subtotal,
            isCartOpen,
            setIsCartOpen
        }}>
            {children}
        </CartContext.Provider>
    );
}

export function useCart() {
    const context = useContext(CartContext);
    if (context === undefined) {
        throw new Error('useCart must be used within a CartProvider');
    }
    return context;
}
