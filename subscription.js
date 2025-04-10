// Initialize Supabase client
const supabaseUrl = 'https://zkiuxmgzevvgcyglecgk.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpraXV4bWd6ZXZ2Z2N5Z2xlY2drIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDQyNDAxMzYsImV4cCI6MjA1OTgxNjEzNn0.CoSia_2aZ-zj1DAfiwzuPMBojUALssUw4CUlunLDq04';
// Fix: Use window.supabase to access the Supabase client library
const supabase = window.supabase.createClient(supabaseUrl, supabaseKey);

// Server API base URL - dynamically select based on environment
const isProduction = window.location.hostname !== 'localhost';
const API_URL = isProduction ? '/.netlify/functions' : 'http://localhost:3000/api';

// Debug info
console.log(`Environment: ${isProduction ? 'Production' : 'Local'}, API_URL: ${API_URL}`);

// Initialize Stripe
let stripe;
let currentSubscription = { status: 'none' };
let user = null;
let userProfile = null;

// Loading overlay
const loadingOverlay = document.createElement('div');
loadingOverlay.className = 'loading-overlay';
loadingOverlay.innerHTML = '<div class="spinner"></div>';
document.body.appendChild(loadingOverlay);

// Show loading
function showLoading() {
    loadingOverlay.classList.add('active');
}

// Hide loading
function hideLoading() {
    loadingOverlay.classList.remove('active');
}

// Check if user is logged in
async function checkAuth() {
    showLoading();
    
    try {
        const { data: { user: currentUser }, error } = await supabase.auth.getUser();
        
        if (error || !currentUser) {
            // Redirect to login if not authenticated
            window.location.href = 'auth.html?redirect=subscription.html';
            return;
        }
        
        user = currentUser;
        
        // Get user profile
        const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', user.id)
            .single();
            
        if (profileError) {
            console.error('Error fetching user profile:', profileError);
        } else {
            userProfile = profile;
            // Update the UI to display user info
            updateUserDisplay();
        }
        
        // Initialize the subscription page
        await initializeSubscription();
    } catch (error) {
        console.error('Error checking authentication:', error);
    } finally {
        hideLoading();
    }
}

// Update user display in header
function updateUserDisplay() {
    const userProfileContainer = document.getElementById('user-profile-container');
    
    if (user && userProfile) {
        userProfileContainer.innerHTML = `
            <span class="user-name">${userProfile.full_name || user.email}</span>
            <a href="dashboard.html" class="dashboard-link">Dashboard</a>
            <button id="logout-button" class="logout-button">Logout</button>
        `;
        
        // Add logout event listener
        document.getElementById('logout-button').addEventListener('click', handleLogout);
    } else {
        userProfileContainer.innerHTML = `
            <a href="auth.html" class="login-button">Login</a>
        `;
    }
}

// Handle logout
async function handleLogout() {
    showLoading();
    
    try {
        const { error } = await supabase.auth.signOut();
        
        if (error) {
            console.error('Error logging out:', error);
        } else {
            window.location.href = 'index.html';
        }
    } catch (error) {
        console.error('Error during logout:', error);
    } finally {
        hideLoading();
    }
}

// Initialize subscription page
async function initializeSubscription() {
    showLoading();
    
    try {
        // Get Stripe publishable key and plans
        const response = await fetch(`${API_URL}/config`);
        const { publishableKey, plans } = await response.json();
        
        // Initialize Stripe
        stripe = Stripe(publishableKey);
        
        // Get user's subscription status
        await getUserSubscription();
        
        // Update UI based on subscription status
        updateSubscriptionUI(plans);
        
        // Set up click handlers for subscription buttons
        setupSubscriptionButtons();
        
        // Set up FAQ toggles
        setupFaqToggles();
    } catch (error) {
        console.error('Error initializing subscription page:', error);
    } finally {
        hideLoading();
    }
}

// Get user's subscription status
async function getUserSubscription() {
    try {
        if (!user) return;
        
        const response = await fetch(`${API_URL}/subscription/${user.id}`);
        const subscriptionData = await response.json();
        
        currentSubscription = subscriptionData;
    } catch (error) {
        console.error('Error getting subscription status:', error);
        currentSubscription = { status: 'none' };
    }
}

// Update UI based on subscription status
function updateSubscriptionUI(plans) {
    const buttons = document.querySelectorAll('.plan-button');
    
    // Reset all buttons
    buttons.forEach(button => {
        button.disabled = false;
        button.textContent = 'Subscribe';
        button.classList.remove('current');
    });
    
    // Update based on current subscription
    if (currentSubscription.status === 'active') {
        // Find the current plan
        const planId = currentSubscription.plan;
        
        buttons.forEach(button => {
            if (button.dataset.planId === planId) {
                button.disabled = true;
                button.textContent = 'Current Plan';
                button.classList.add('current');
            } else if (button.closest('.plan-card').classList.contains('free')) {
                button.disabled = true;
                button.textContent = 'Current Plan';
                button.classList.add('current');
            }
        });
    } else {
        // User has no active subscription, mark free as current
        const freeButton = document.querySelector('.free .plan-button');
        if (freeButton) {
            freeButton.disabled = true;
            freeButton.textContent = 'Current Plan';
            freeButton.classList.add('current');
        }
    }
}

// Set up click handlers for subscription buttons
function setupSubscriptionButtons() {
    const buttons = document.querySelectorAll('.plan-button:not([disabled])');
    
    buttons.forEach(button => {
        button.addEventListener('click', async function() {
            if (!user) {
                window.location.href = 'auth.html?redirect=subscription.html';
                return;
            }
            
            const planId = this.dataset.planId;
            if (!planId) return;
            
            showLoading();
            
            try {
                const response = await fetch(`${API_URL}/create-checkout-session`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        planId: planId,
                        userId: user.id,
                        userEmail: user.email
                    }),
                });
                
                const { sessionId, url } = await response.json();
                
                // Redirect to Stripe checkout
                window.location.href = url;
            } catch (error) {
                console.error('Error creating checkout session:', error);
                hideLoading();
                alert('An error occurred while processing your request. Please try again.');
            }
        });
    });
}

// Set up FAQ toggles
function setupFaqToggles() {
    const faqItems = document.querySelectorAll('.faq-item');
    
    faqItems.forEach(item => {
        const question = item.querySelector('.faq-question');
        
        question.addEventListener('click', function() {
            const isActive = item.classList.contains('active');
            
            // Close all active items
            document.querySelectorAll('.faq-item.active').forEach(activeItem => {
                activeItem.classList.remove('active');
            });
            
            // Toggle current item
            if (!isActive) {
                item.classList.add('active');
            }
        });
    });
}

// Initialize the page
document.addEventListener('DOMContentLoaded', checkAuth);
