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
    // Carried through to order_items so warehouse/POS can pack the right
    // size/colour. Variant SKU wins over product SKU when present.
    sku?: string;
    variantId?: string;
    // Picked option values, kept separate from `variant` (which is the joined
    // display string like "38 / Black") so the admin/order screens can render
    // them as their own prominent pills.
    size?: string;
    color?: string;
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

    // Load cart from localStorage on mount (sanitize so no invalid data causes crashes)
    useEffect(() => {
        const savedCart = localStorage.getItem('cart');
        if (savedCart) {
            try {
                const parsed = JSON.parse(savedCart);
                if (Array.isArray(parsed)) {
                    const safe = parsed.map((item: any) => {
                        const maxStock = Number(item?.maxStock) > 0 ? Number(item.maxStock) : 999;
                        const qty = Number(item?.quantity) || 1;
                        return {
                            id: item?.id ?? '',
                            name: item?.name ?? 'Product',
                            price: Number(item?.price) || 0,
                            image: typeof item?.image === 'string' ? item.image : 'https://via.placeholder.com/400x400?text=Product',
                            quantity: Math.max(1, Math.min(qty, maxStock)),
                            variant: item?.variant,
                            slug: item?.slug ?? item?.id ?? '',
                            maxStock,
                            sku: typeof item?.sku === 'string' ? item.sku : undefined,
                            variantId: typeof item?.variantId === 'string' ? item.variantId : undefined,
                            size: typeof item?.size === 'string' ? item.size : undefined,
                            color: typeof item?.color === 'string' ? item.color : undefined,
                        };
                    }).filter((item: any) => item.id);
                    setCart(safe);
                }
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
                const latestMaxStock = Number(newItem.maxStock) > 0 ? Number(newItem.maxStock) : Number(existingItem.maxStock);
                const cap = Number.isNaN(latestMaxStock) || latestMaxStock <= 0 ? 999 : latestMaxStock;
                const newQuantity = Math.min(
                    existingItem.quantity + newItem.quantity,
                    cap
                );
                newCart[existingItemIndex] = { ...existingItem, quantity: newQuantity, maxStock: cap };
                return newCart;
            } else {
                const maxStock = Number(newItem.maxStock) > 0 ? Number(newItem.maxStock) : 999;
                const requestedQty = Math.max(1, Number(newItem.quantity) || 1);
                const safeItem = {
                    ...newItem,
                    maxStock,
                    price: Number(newItem.price) || 0,
                    quantity: Math.min(requestedQty, maxStock),
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

    const cartCount = cart.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);
    const subtotal = cart.reduce((sum, item) => sum + ((Number(item.price) || 0) * (Number(item.quantity) || 0)), 0);

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
