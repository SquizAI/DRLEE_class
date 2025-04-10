// Initialize Supabase client
// IMPORTANT: Public anon key only, not service role key
const supabaseUrl = 'https://zkiuxmgzevvgcyglecgk.supabase.co';
// This is a public anon key that is safe to be in client code
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpraXV4bWd6ZXZ2Z2N5Z2xlY2drIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDQyNDAxMzYsImV4cCI6MjA1OTgxNjEzNn0.CoSia_2aZ-zj1DAfiwzuPMBojUALssUw4CUlunLDq04';
// Fix: use the imported library correctly
const supabase = window.supabase.createClient(supabaseUrl, supabaseKey);

// Server API base URL
const API_URL = 'http://localhost:3000/api';

// Store the current user
let currentUser = null;
let userProfile = null;

// Subscription plans data
const SUBSCRIPTION_PLANS = {
    free: {
        id: 'free',
        name: 'Free',
        price: 0,
        features: [
            'Access to Transformers content only',
            'Basic dashboard'
        ]
    },
    basic: {
        id: 'price_basic',
        name: 'Basic',
        price: 9.99,
        features: [
            'Access to Transformers content',
            'Access to XGBoost content',
            'Basic progress tracking',
            'Email support'
        ]
    },
    pro: {
        id: 'price_pro',
        name: 'Pro',
        price: 19.99,
        features: [
            'Access to ALL content',
            'Advanced progress tracking',
            'Priority email support',
            'Monthly live Q&A sessions',
            'Premium resources & example code'
        ]
    }
};

// DOM Elements
const chatMessages = document.getElementById('chat-messages');
const chatForm = document.getElementById('chat-form');
const chatInput = document.getElementById('chat-input');
const userProfileContainer = document.getElementById('user-profile-container');
const loadingOverlay = document.getElementById('loading-overlay');
const checkoutModal = document.getElementById('checkout-modal');
const signupModal = document.getElementById('signup-modal');

// Close modals when clicking on close button or outside the modal
document.querySelectorAll('.close-modal').forEach(button => {
    button.addEventListener('click', () => {
        checkoutModal.style.display = 'none';
        signupModal.style.display = 'none';
    });
});

window.addEventListener('click', (event) => {
    if (event.target === checkoutModal) {
        checkoutModal.style.display = 'none';
    }
    if (event.target === signupModal) {
        signupModal.style.display = 'none';
    }
});

// Initialize authentication
document.addEventListener('DOMContentLoaded', async () => {
    await checkAuth();
    setupEventListeners();
});

// Check if user is logged in
async function checkAuth() {
    showLoading();
    
    try {
        const { data: { user }, error } = await supabase.auth.getUser();
        
        if (error || !user) {
            updateUserDisplay(null);
            return;
        }
        
        currentUser = user;
        
        // Get user profile
        // Fix: Change the format of the query to use a more reliable approach
        const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', user.id)
            .maybeSingle();
            
        if (!profileError && profile) {
            userProfile = profile;
        }
        
        updateUserDisplay(user, profile);
    } catch (error) {
        console.error('Error checking authentication:', error);
    } finally {
        hideLoading();
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
    showLoading();
    
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
    } finally {
        hideLoading();
    }
}

// Set up event listeners
function setupEventListeners() {
    // Chat form submission
    chatForm.addEventListener('submit', handleChatSubmit);
    
    // Topic buttons
    document.querySelectorAll('.topic-button').forEach(button => {
        button.addEventListener('click', () => {
            const topic = button.dataset.topic;
            chatInput.value = topic;
            handleChatSubmit(new Event('submit'));
        });
    });
    
    // Authentication tabs
    document.querySelectorAll('.auth-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            const tabId = tab.dataset.tab;
            
            // Update active tab
            document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            
            // Show corresponding form
            document.querySelectorAll('.auth-form').forEach(form => form.classList.remove('active'));
            document.getElementById(`${tabId}-form`).classList.add('active');
        });
    });
    
    // Signup form
    document.getElementById('signup-form').addEventListener('submit', handleSignup);
    
    // Login form
    document.getElementById('login-form').addEventListener('submit', handleLogin);
    
    // Checkout button
    document.getElementById('checkout-button').addEventListener('click', handleCheckout);
    
    // Cancel checkout
    document.getElementById('cancel-checkout').addEventListener('click', () => {
        checkoutModal.style.display = 'none';
    });
}

// Handle chat form submission
async function handleChatSubmit(event) {
    event.preventDefault();
    
    const message = chatInput.value.trim();
    if (!message) return;
    
    // Add user message to chat
    addMessage('user', message);
    
    // Clear input
    chatInput.value = '';
    
    // Show loading indicator
    const loadingMessage = addMessage('assistant', '<div class="typing-indicator"><span></span><span></span><span></span></div>');
    
    try {
        // Send message to AI with timeout and retry logic
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
        
        const response = await fetch(`${API_URL}/chat`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                message,
                userId: currentUser?.id
            }),
            signal: controller.signal
        }).catch(async (error) => {
            if (error.name === 'AbortError') {
                console.log('Request timed out, retrying...');
                // Try once more with a longer timeout
                return await fetch(`${API_URL}/chat`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        message,
                        userId: currentUser?.id
                    })
                });
            }
            throw error;
        });
        
        clearTimeout(timeoutId);
        
        if (!response.ok) {
            console.error('Server response error:', response.status, response.statusText);
            throw new Error(`Server error: ${response.status}`);
        }
        
        const aiResponse = await response.json();
        
        // Remove loading message
        loadingMessage.remove();
        
        // Handle different response types
        handleResponseByType(aiResponse);
    } catch (error) {
        console.error('Error sending message:', error);
        
        // Remove loading message
        loadingMessage.remove();
        
        // Prepare user-friendly error message
        let errorMessage = 'Sorry, I encountered an error processing your request.';
        
        if (error.message.includes('Server error: 500')) {
            errorMessage = 'The server encountered an issue processing your request. This could be due to high traffic or a temporary service disruption.';
        } else if (error.message.includes('Failed to fetch') || error.name === 'TypeError') {
            errorMessage = 'Unable to connect to the server. Please check your internet connection and try again.';
        } else if (error.name === 'AbortError') {
            errorMessage = 'The request took too long to process. Please try a simpler question or try again later when the system is less busy.';
        }
        
        // Show error message with retry button
        addMessage('assistant', `
            <div class="error-message">
                <p>${errorMessage}</p>
                <button class="retry-button" onclick="handleChatSubmit(new Event('submit', {message: '${message.replace(/'/g, "\'")}'}))">Retry</button>
            </div>
        `);
    }
}

// Handle AI response based on response type
function handleResponseByType(response) {
    switch (response.responseType) {
        case 'generalInfo':
            renderGeneralInfo(response);
            break;
        case 'algorithmInfo':
            renderAlgorithmInfo(response);
            break;
        case 'subscriptionInfo':
            renderSubscriptionInfo(response);
            break;
        case 'signupProcess':
            renderSignupProcess(response);
            break;
        case 'checkout':
            renderCheckout(response);
            break;
        default:
            addMessage('assistant', response.content.message || 'I\'m not sure how to respond to that.');
    }
}

// Render general information response
function renderGeneralInfo(response) {
    let messageContent = response.content.message;
    
    // Add links if provided
    if (response.content.links && response.content.links.length > 0) {
        messageContent += '<div class="links-list">';
        response.content.links.forEach(link => {
            messageContent += `
                <a href="${link.url}" class="link-item" target="_blank">
                    <span class="link-icon"><i class="fas fa-external-link-alt"></i></span>
                    <span>${link.text}</span>
                </a>
            `;
        });
        messageContent += '</div>';
    }
    
    addMessage('assistant', messageContent);
}

// Render algorithm information response
function renderAlgorithmInfo(response) {
    let messageContent = response.content.message;
    
    // Add algorithm card if details are provided
    if (response.algorithmDetails) {
        const { name, description, difficulty, category } = response.algorithmDetails;
        
        messageContent += `
            <div class="algorithm-card">
                <h4>${name}</h4>
                <p>${description}</p>
                <div>
                    <span class="difficulty-badge ${difficulty}">${difficulty.charAt(0).toUpperCase() + difficulty.slice(1)}</span>
                    <span class="category-badge">${category}</span>
                </div>
            </div>
        `;
    }
    
    // Add action buttons
    messageContent += `
        <div class="action-buttons">
            <button class="action-button primary" onclick="location.href='index.html#${response.algorithmDetails?.name?.toLowerCase() || 'algorithms'}'">Learn More</button>
            <button class="action-button secondary" onclick="location.href='subscription.html'">Upgrade for Full Access</button>
        </div>
    `;
    
    addMessage('assistant', messageContent);
}

// Render subscription information response
function renderSubscriptionInfo(response) {
    let messageContent = response.content.message;
    
    // Add subscription comparison cards
    messageContent += `
        <div class="subscription-card">
            <div class="plan-comparison">
                <div class="mini-plan-card">
                    <h5>Free</h5>
                    <div class="price">$0<span>/mo</span></div>
                    <ul>
                        <li>Transformers content only</li>
                        <li>Basic dashboard</li>
                    </ul>
                    <button class="plan-button" disabled>Current</button>
                </div>
                <div class="mini-plan-card">
                    <h5>Basic</h5>
                    <div class="price">$9.99<span>/mo</span></div>
                    <ul>
                        <li>Transformers & XGBoost</li>
                        <li>Basic progress tracking</li>
                    </ul>
                    <button class="plan-button" onclick="showCheckoutModal('price_basic')">Subscribe</button>
                </div>
                <div class="mini-plan-card recommended">
                    <h5>Pro</h5>
                    <div class="price">$19.99<span>/mo</span></div>
                    <ul>
                        <li>All algorithms</li>
                        <li>Advanced tracking</li>
                        <li>Priority support</li>
                    </ul>
                    <button class="plan-button" onclick="showCheckoutModal('price_pro')">Subscribe</button>
                </div>
            </div>
        </div>
    `;
    
    addMessage('assistant', messageContent);
}

// Render signup process response
function renderSignupProcess(response) {
    let messageContent = response.content.message;
    
    // Add signup button
    messageContent += `
        <div class="action-buttons">
            <button class="action-button primary" onclick="showSignupModal()">Sign Up Now</button>
            <button class="action-button secondary" onclick="location.href='auth.html'">Go to Login Page</button>
        </div>
    `;
    
    addMessage('assistant', messageContent);
}

// Render checkout response
function renderCheckout(response) {
    let messageContent = response.content.message;
    
    // Add checkout button
    if (response.checkoutOptions) {
        messageContent += `
            <div class="action-buttons">
                <button class="action-button primary" onclick="showCheckoutModal('${response.checkoutOptions.planId}')">
                    Subscribe to ${response.checkoutOptions.planName}
                </button>
                <button class="action-button secondary" onclick="location.href='subscription.html'">
                    Compare Plans
                </button>
            </div>
        `;
    }
    
    addMessage('assistant', messageContent);
}

// Show checkout modal
window.showCheckoutModal = function(planId) {
    // If user is not logged in, show signup modal instead
    if (!currentUser) {
        showSignupModal();
        return;
    }
    
    const plan = SUBSCRIPTION_PLANS[planId === 'price_basic' ? 'basic' : planId === 'price_pro' ? 'pro' : 'free'];
    
    // Update modal content
    document.getElementById('plan-name').textContent = plan.name;
    document.getElementById('checkout-plan-name').textContent = plan.name + ' Plan';
    document.getElementById('plan-price').textContent = plan.price.toFixed(2);
    
    // Update features list
    const featuresList = document.getElementById('plan-features');
    featuresList.innerHTML = '';
    plan.features.forEach(feature => {
        const li = document.createElement('li');
        li.textContent = feature;
        featuresList.appendChild(li);
    });
    
    // Show user info or login prompt
    const userInfoContainer = document.getElementById('checkout-user-info');
    if (currentUser) {
        userInfoContainer.innerHTML = `
            <div class="user-summary">
                <h4>Account Information</h4>
                <p><strong>Email:</strong> ${currentUser.email}</p>
                <p><strong>Name:</strong> ${userProfile?.full_name || 'Not provided'}</p>
            </div>
        `;
    } else {
        userInfoContainer.innerHTML = `
            <div class="login-prompt">
                <p>Please log in or sign up to continue with your subscription</p>
                <button class="auth-button" onclick="showSignupModal()">Login / Sign Up</button>
            </div>
        `;
    }
    
    // Store selected plan ID for checkout
    document.getElementById('checkout-button').dataset.planId = plan.id;
    
    // Show modal
    checkoutModal.style.display = 'block';
};

// Show signup modal
window.showSignupModal = function() {
    signupModal.style.display = 'block';
};

// Handle checkout button click
async function handleCheckout() {
    if (!currentUser) {
        showSignupModal();
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
                userId: currentUser.id,
                userEmail: currentUser.email
            }),
        });
        
        if (!response.ok) {
            throw new Error('Network response was not ok');
        }
        
        const { url } = await response.json();
        
        // Redirect to Stripe checkout
        window.location.href = url;
    } catch (error) {
        console.error('Error creating checkout session:', error);
        hideLoading();
        alert('An error occurred while processing your request. Please try again.');
    }
}

// Handle signup form submission
async function handleSignup(event) {
    event.preventDefault();
    
    const fullName = document.getElementById('signup-name').value.trim();
    const email = document.getElementById('signup-email').value.trim();
    const password = document.getElementById('signup-password').value;
    
    if (!fullName || !email || !password) {
        alert('Please fill in all fields');
        return;
    }
    
    showLoading();
    
    try {
        const { data, error } = await supabase.auth.signUp({
            email,
            password,
            options: {
                data: {
                    full_name: fullName
                }
            }
        });
        
        if (error) {
            throw error;
        }
        
        if (data?.user) {
            // Create profile
            await supabase.from('profiles').insert([
                {
                    id: data.user.id,
                    full_name: fullName,
                    email: email
                }
            ]);
            
            currentUser = data.user;
            
            // Close modal
            signupModal.style.display = 'none';
            
            // Update user display
            await checkAuth();
            
            // Show success message
            addMessage('assistant', `
                <h3>Welcome, ${fullName}! 🎉</h3>
                <p>Your account has been created successfully. You can now access the basic content and subscribe to premium plans.</p>
                <div class="action-buttons">
                    <button class="action-button primary" onclick="location.href='dashboard.html'">Go to Dashboard</button>
                    <button class="action-button secondary" onclick="location.href='subscription.html'">Explore Plans</button>
                </div>
            `);
        }
    } catch (error) {
        console.error('Error signing up:', error);
        alert(error.message || 'An error occurred during signup');
    } finally {
        hideLoading();
    }
}

// Handle login form submission
async function handleLogin(event) {
    event.preventDefault();
    
    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;
    
    if (!email || !password) {
        alert('Please fill in all fields');
        return;
    }
    
    showLoading();
    
    try {
        const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password
        });
        
        if (error) {
            throw error;
        }
        
        if (data?.user) {
            currentUser = data.user;
            
            // Close modal
            signupModal.style.display = 'none';
            
            // Update user display
            await checkAuth();
            
            // Show success message
            addMessage('assistant', `
                <h3>Welcome back! 👋</h3>
                <p>You've been logged in successfully.</p>
                <div class="action-buttons">
                    <button class="action-button primary" onclick="location.href='dashboard.html'">Go to Dashboard</button>
                    <button class="action-button secondary" onclick="location.href='subscription.html'">Manage Subscription</button>
                </div>
            `);
        }
    } catch (error) {
        console.error('Error logging in:', error);
        alert(error.message || 'An error occurred during login');
    } finally {
        hideLoading();
    }
}

// Add message to chat
function addMessage(sender, content) {
    const messageElement = document.createElement('div');
    messageElement.className = `message ${sender}`;
    
    const avatarIcon = sender === 'user' ? 'user' : 'robot';
    
    messageElement.innerHTML = `
        <div class="message-avatar">
            <i class="fas fa-${avatarIcon}"></i>
        </div>
        <div class="message-content">
            <div class="message-bubble">
                ${content}
            </div>
            <div class="message-time">${getFormattedTime()}</div>
        </div>
    `;
    
    chatMessages.appendChild(messageElement);
    
    // Scroll to bottom
    chatMessages.scrollTop = chatMessages.scrollHeight;
    
    return messageElement;
}

// Get formatted time
function getFormattedTime() {
    const now = new Date();
    const hours = now.getHours().toString().padStart(2, '0');
    const minutes = now.getMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;
}

// Show loading overlay
function showLoading() {
    loadingOverlay.classList.add('active');
}

// Hide loading overlay
function hideLoading() {
    loadingOverlay.classList.remove('active');
}
