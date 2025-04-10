// Initialize Supabase client
const supabaseUrl = 'https://zkiuxmgzevvgcyglecgk.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpraXV4bWd6ZXZ2Z2N5Z2xlY2drIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDQyNDAxMzYsImV4cCI6MjA1OTgxNjEzNn0.CoSia_2aZ-zj1DAfiwzuPMBojUALssUw4CUlunLDq04';
const supabase = supabase.createClient(supabaseUrl, supabaseKey);

// Initialize Stripe
const stripePublishableKey = 'pk_test_51RC8N82clMPrLXtYOLJSPAZ1z3sDz66BiaGGPZhNpCfwmT510eRmQJjZ0PEFqkLd7JdxJK3k21Tg6MReAzUk0KMk003Ohi0H46';
const stripe = Stripe(stripePublishableKey);

// Store the current user
let currentUser = null;
let userProfile = null;

// Cart state
let cart = JSON.parse(localStorage.getItem('drLeeCart')) || [];
updateCartCount();

// DOM Elements
const userProfileContainer = document.getElementById('user-profile-container');
const cartIcon = document.getElementById('cart-icon');
const cartSidebar = document.getElementById('cart-sidebar');
const cartOverlay = document.getElementById('cart-overlay');
const closeCart = document.getElementById('close-cart');
const cartItems = document.getElementById('cart-items');
const cartTotal = document.getElementById('cart-total');
const checkoutButton = document.getElementById('checkout-button');
const colorOptions = document.querySelectorAll('.color-option');
const sizeOptions = document.querySelectorAll('.size-option');
const addToCartButtons = document.querySelectorAll('.add-to-cart-button');

// Initialize authentication
document.addEventListener('DOMContentLoaded', async () => {
    await checkAuth();
    setupEventListeners();
});

// Check if user is logged in
async function checkAuth() {
    try {
        const { data: { user }, error } = await supabase.auth.getUser();
        
        if (error || !user) {
            updateUserDisplay(null);
            return;
        }
        
        currentUser = user;
        
        // Get user profile
        const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', user.id)
            .single();
            
        if (!profileError && profile) {
            userProfile = profile;
        }
        
        updateUserDisplay(user, profile);
    } catch (error) {
        console.error('Error checking authentication:', error);
    }
}

// Update user display in header
function updateUserDisplay(user, profile = null) {
    if (user) {
        userProfileContainer.innerHTML = `
            <span class="user-name">${profile?.full_name || user.email}</span>
            <a href="dashboard.html" class="dashboard-link">Dashboard</a>
            <button id="logout-button" class="logout-button">Logout</button>
        `;
        
        // Add logout event listener
        document.getElementById('logout-button').addEventListener('click', handleLogout);
    } else {
        userProfileContainer.innerHTML = `
            <a href="auth.html" class="login-button">Login</a>
            <a href="auth.html#signup" class="signup-button">Sign Up</a>
        `;
    }
}

// Handle logout
async function handleLogout() {
    try {
        const { error } = await supabase.auth.signOut();
        
        if (error) {
            console.error('Error logging out:', error);
        } else {
            currentUser = null;
            userProfile = null;
            updateUserDisplay(null);
        }
    } catch (error) {
        console.error('Error during logout:', error);
    }
}

// Set up event listeners
function setupEventListeners() {
    // Cart toggle
    cartIcon.addEventListener('click', toggleCart);
    closeCart.addEventListener('click', toggleCart);
    cartOverlay.addEventListener('click', toggleCart);
    
    // Checkout button
    checkoutButton.addEventListener('click', handleCheckout);
    
    // Color options
    colorOptions.forEach(option => {
        option.addEventListener('click', function() {
            // Find all color options in this product and remove selected class
            const productCard = this.closest('.product-card');
            const colorOptions = productCard.querySelectorAll('.color-option');
            colorOptions.forEach(opt => opt.classList.remove('selected'));
            
            // Add selected class to clicked option
            this.classList.add('selected');
        });
    });
    
    // Size options
    sizeOptions.forEach(option => {
        option.addEventListener('click', function() {
            // Find all size options in this product and remove selected class
            const productCard = this.closest('.product-card');
            const sizeOptions = productCard.querySelectorAll('.size-option');
            sizeOptions.forEach(opt => opt.classList.remove('selected'));
            
            // Add selected class to clicked option
            this.classList.add('selected');
        });
    });
    
    // Add to cart buttons
    addToCartButtons.forEach(button => {
        button.addEventListener('click', function() {
            const productCard = this.closest('.product-card');
            const productId = this.dataset.productId;
            const productName = this.dataset.productName;
            const productPrice = parseFloat(this.dataset.productPrice);
            const productImage = productCard.querySelector('.product-image img').src;
            
            // Get selected color and size
            const selectedColor = productCard.querySelector('.color-option.selected').dataset.color;
            const selectedSize = productCard.querySelector('.size-option.selected').dataset.size;
            
            // Add item to cart
            addToCart(productId, productName, productPrice, productImage, selectedColor, selectedSize);
            
            // Show success message
            showNotification(`${productName} (${selectedColor}, ${selectedSize}) added to cart!`);
        });
    });
}

// Toggle cart sidebar
function toggleCart() {
    cartSidebar.classList.toggle('active');
    cartOverlay.classList.toggle('active');
    
    // If opening cart, update cart items
    if (cartSidebar.classList.contains('active')) {
        renderCartItems();
    }
}

// Add item to cart
function addToCart(id, name, price, image, color, size) {
    // Check if item already exists in cart with same options
    const existingItem = cart.find(item => 
        item.id === id && 
        item.color === color && 
        item.size === size
    );
    
    if (existingItem) {
        // Increment quantity if item exists
        existingItem.quantity += 1;
    } else {
        // Add new item if it doesn't exist
        cart.push({
            id,
            name,
            price,
            image,
            color,
            size,
            quantity: 1
        });
    }
    
    // Save cart to local storage
    localStorage.setItem('drLeeCart', JSON.stringify(cart));
    
    // Update cart count
    updateCartCount();
}

// Update cart count in header
function updateCartCount() {
    const totalItems = cart.reduce((total, item) => total + item.quantity, 0);
    document.getElementById('cart-count').textContent = totalItems;
}

// Render cart items
function renderCartItems() {
    if (cart.length === 0) {
        cartItems.innerHTML = '<div class="empty-cart-message">Your cart is empty</div>';
        cartTotal.textContent = '$0.00';
        return;
    }
    
    let total = 0;
    let cartHTML = '';
    
    cart.forEach((item, index) => {
        const itemTotal = item.price * item.quantity;
        total += itemTotal;
        
        cartHTML += `
            <div class="cart-item" data-index="${index}">
                <div class="cart-item-image">
                    <img src="${item.image}" alt="${item.name}">
                </div>
                <div class="cart-item-details">
                    <div class="cart-item-name">${item.name}</div>
                    <div class="cart-item-variant">${item.color}, Size ${item.size}</div>
                    <div class="cart-item-price">$${item.price.toFixed(2)}</div>
                    <div class="cart-item-actions">
                        <div class="quantity-control">
                            <button class="quantity-btn decrease-quantity" data-index="${index}">-</button>
                            <input type="text" class="quantity-input" value="${item.quantity}" readonly>
                            <button class="quantity-btn increase-quantity" data-index="${index}">+</button>
                        </div>
                        <button class="remove-item" data-index="${index}">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
            </div>
        `;
    });
    
    cartItems.innerHTML = cartHTML;
    cartTotal.textContent = `$${total.toFixed(2)}`;
    
    // Add event listeners to quantity buttons and remove buttons
    cartItems.querySelectorAll('.increase-quantity').forEach(button => {
        button.addEventListener('click', increaseQuantity);
    });
    
    cartItems.querySelectorAll('.decrease-quantity').forEach(button => {
        button.addEventListener('click', decreaseQuantity);
    });
    
    cartItems.querySelectorAll('.remove-item').forEach(button => {
        button.addEventListener('click', removeItem);
    });
}

// Increase item quantity
function increaseQuantity() {
    const index = this.dataset.index;
    cart[index].quantity += 1;
    
    // Save cart to local storage
    localStorage.setItem('drLeeCart', JSON.stringify(cart));
    
    // Update cart UI
    renderCartItems();
    updateCartCount();
}

// Decrease item quantity
function decreaseQuantity() {
    const index = this.dataset.index;
    
    if (cart[index].quantity > 1) {
        cart[index].quantity -= 1;
    } else {
        // Remove item if quantity would become 0
        cart.splice(index, 1);
    }
    
    // Save cart to local storage
    localStorage.setItem('drLeeCart', JSON.stringify(cart));
    
    // Update cart UI
    renderCartItems();
    updateCartCount();
}

// Remove item from cart
function removeItem() {
    const index = this.dataset.index;
    cart.splice(index, 1);
    
    // Save cart to local storage
    localStorage.setItem('drLeeCart', JSON.stringify(cart));
    
    // Update cart UI
    renderCartItems();
    updateCartCount();
}

// Show notification
function showNotification(message) {
    // Create notification element
    const notification = document.createElement('div');
    notification.className = 'notification';
    notification.innerHTML = `
        <div class="notification-content">
            <i class="fas fa-check-circle"></i>
            <span>${message}</span>
        </div>
    `;
    
    // Add notification to body
    document.body.appendChild(notification);
    
    // Show notification (wait a bit for the DOM to update)
    setTimeout(() => {
        notification.classList.add('active');
    }, 10);
    
    // Remove notification after delay
    setTimeout(() => {
        notification.classList.remove('active');
        setTimeout(() => {
            notification.remove();
        }, 300);
    }, 3000);
}

// Handle checkout
async function handleCheckout() {
    // If cart is empty, show a message
    if (cart.length === 0) {
        showNotification('Your cart is empty!');
        return;
    }
    
    // If user is not logged in, redirect to login page
    if (!currentUser) {
        window.location.href = 'auth.html?redirect=merch.html';
        return;
    }
    
    // Create checkout session with line items for each cart item
    const lineItems = cart.map(item => ({
        price_data: {
            currency: 'usd',
            product_data: {
                name: `${item.name} - ${item.color} (${item.size})`,
                description: 'DR LEE is DA man Official Merchandise',
                images: [item.image]
            },
            unit_amount: Math.round(item.price * 100), // Convert to cents
        },
        quantity: item.quantity
    }));
    
    try {
        // In a real implementation, this would call your backend to create a Stripe checkout session
        // For demo purposes, we're simulating a successful checkout
        
        showNotification('Processing your order...');
        
        // Simulate a delay
        setTimeout(() => {
            // Clear cart after successful checkout
            cart = [];
            localStorage.setItem('drLeeCart', JSON.stringify(cart));
            updateCartCount();
            
            // Close cart sidebar
            toggleCart();
            
            // Show success message with more details
            const successMessage = document.createElement('div');
            successMessage.className = 'checkout-success';
            successMessage.innerHTML = `
                <div class="success-overlay"></div>
                <div class="success-modal">
                    <div class="success-icon">
                        <i class="fas fa-check-circle"></i>
                    </div>
                    <h2>Order Successful!</h2>
                    <p>Thank you for your purchase. Your "DR LEE is DA man" merchandise is on its way!</p>
                    <p class="success-details">Order confirmation has been sent to your email address.</p>
                    <button class="success-button">Continue Shopping</button>
                </div>
            `;
            
            document.body.appendChild(successMessage);
            
            // Add event listener to continue button
            successMessage.querySelector('.success-button').addEventListener('click', () => {
                successMessage.remove();
            });
            
        }, 2000);
        
    } catch (error) {
        console.error('Error creating checkout session:', error);
        showNotification('An error occurred during checkout. Please try again.');
    }
}

// Add styles for notifications and checkout success
const style = document.createElement('style');
style.textContent = `
    .notification {
        position: fixed;
        top: 20px;
        right: 20px;
        transform: translateX(120%);
        transition: transform 0.3s ease;
        z-index: 1000;
    }
    
    .notification.active {
        transform: translateX(0);
    }
    
    .notification-content {
        background-color: #4caf50;
        color: white;
        padding: 15px 20px;
        border-radius: 5px;
        box-shadow: 0 3px 10px rgba(0, 0, 0, 0.2);
        display: flex;
        align-items: center;
        gap: 10px;
    }
    
    .notification-content i {
        font-size: 20px;
    }
    
    .checkout-success {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 1100;
    }
    
    .success-overlay {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background-color: rgba(0, 0, 0, 0.7);
    }
    
    .success-modal {
        background-color: white;
        border-radius: 10px;
        padding: 40px;
        text-align: center;
        max-width: 500px;
        width: 90%;
        position: relative;
        z-index: 1;
        box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
    }
    
    .success-icon {
        font-size: 60px;
        color: #4caf50;
        margin-bottom: 20px;
    }
    
    .success-modal h2 {
        font-size: 28px;
        margin-bottom: 15px;
        color: #333;
    }
    
    .success-modal p {
        font-size: 16px;
        color: #666;
        margin-bottom: 10px;
        line-height: 1.5;
    }
    
    .success-details {
        font-size: 14px;
        color: #999;
        margin-bottom: 25px;
    }
    
    .success-button {
        padding: 12px 25px;
        background-color: #4285f4;
        color: white;
        border: none;
        border-radius: 5px;
        font-size: 16px;
        font-weight: bold;
        cursor: pointer;
        transition: all 0.2s ease;
    }
    
    .success-button:hover {
        background-color: #3367d6;
    }
`;

document.head.appendChild(style);
