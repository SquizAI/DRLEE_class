// Supabase configuration
const SUPABASE_URL = 'https://zkiuxmgzevvgcyglecgk.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpraXV4bWd6ZXZ2Z2N5Z2xlY2drIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDQyNDAxMzYsImV4cCI6MjA1OTgxNjEzNn0.CoSia_2aZ-zj1DAfiwzuPMBojUALssUw4CUlunLDq04';

// Initialize Supabase client
// We need to properly initialize the Supabase client to avoid the 'supabase is not defined' error
let supabaseClient;
document.addEventListener('DOMContentLoaded', function() {
    supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    console.log('Supabase client initialized');
    
    // Initialize tab switching once DOM is loaded
    initializeTabs();
    
    // Initialize form handlers
    initializeLoginForm();
    initializeSignupForm();
});

// Debug function to check if Supabase is available
function checkSupabase() {
    if (typeof supabase === 'undefined') {
        console.error('Supabase is not defined!');
        return false;
    }
    console.log('Supabase is defined.');
    return true;
}

// Tab switching functionality
function initializeTabs() {
    const tabBtns = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');

    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            // Remove active class from all buttons and tab contents
            tabBtns.forEach(b => b.classList.remove('active'));
            tabContents.forEach(c => c.classList.remove('active'));
            
            // Add active class to clicked button
            btn.classList.add('active');
            
            // Show corresponding content
            const tabId = btn.getAttribute('data-tab');
            document.getElementById(tabId).classList.add('active');
        });
    });
    
    // Check URL params for tab selection
    const urlParams = new URLSearchParams(window.location.search);
    const tab = urlParams.get('tab');
    if (tab === 'signup') {
        const signupBtn = document.querySelector('[data-tab="signup"]');
        if (signupBtn) signupBtn.click();
    }
}

// Login form functionality
function initializeLoginForm() {
    const loginForm = document.getElementById('login-form');
    const loginMessage = document.getElementById('login-message');
    
    if (!loginForm) {
        console.error('Login form not found');
        return;
    }

    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const email = document.getElementById('login-email').value;
        const password = document.getElementById('login-password').value;
        
        try {
            showMessage(loginMessage, 'Logging in...', 'info');
            
            // Make sure supabaseClient is defined
            if (!supabaseClient) {
                throw new Error('Supabase client not initialized. Please refresh the page and try again.');
            }
            
            const { data, error } = await supabaseClient.auth.signInWithPassword({
                email,
                password
            });
            
            if (error) throw error;
            
            showMessage(loginMessage, 'Login successful! Redirecting...', 'success');
            
            // Store user session and redirect to dashboard
            localStorage.setItem('user', JSON.stringify(data.user));
            setTimeout(() => {
                window.location.href = 'dashboard.html';
            }, 1500);
            
        } catch (error) {
            console.error('Login error:', error);
            showMessage(loginMessage, `Error: ${error.message}`, 'error');
        }
    });
}

// Signup form functionality
function initializeSignupForm() {
    const signupForm = document.getElementById('signup-form');
    const signupMessage = document.getElementById('signup-message');
    
    if (!signupForm) {
        console.error('Signup form not found');
        return;
    }

    signupForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const email = document.getElementById('signup-email').value;
        const password = document.getElementById('signup-password').value;
        const fullName = document.getElementById('signup-name').value;
        
        try {
            showMessage(signupMessage, 'Creating your account...', 'info');
            
            // Make sure supabaseClient is defined
            if (!supabaseClient) {
                throw new Error('Supabase client not initialized. Please refresh the page and try again.');
            }
            
            console.log('Attempting to sign up with:', { email, fullName });
            
            // Sign up the user
            const { data: authData, error: authError } = await supabaseClient.auth.signUp({
                email,
                password,
                options: {
                    data: {
                        full_name: fullName
                    }
                }
            });
            
            if (authError) throw authError;
            
            console.log('Signup successful, user data:', authData);
            
            if (!authData.user) {
                throw new Error('User data not returned from signup');
            }
            
            // Insert user profile into the database
            const { error: profileError } = await supabaseClient
                .from('profiles')
                .insert([
                    { 
                        id: authData.user.id,
                        full_name: fullName, 
                        email: email,
                        created_at: new Date().toISOString()
                    }
                ]);
            
            if (profileError) {
                console.error('Profile creation error:', profileError);
                // Continue anyway since the auth account was created
            }
            
            showMessage(signupMessage, 'Account created successfully! You can now log in.', 'success');
            
            // Clear form
            signupForm.reset();
            
            // Switch to login tab after successful signup
            setTimeout(() => {
                document.querySelector('[data-tab="login"]').click();
            }, 2000);
            
        } catch (error) {
            console.error('Signup error:', error);
            showMessage(signupMessage, `Error: ${error.message}`, 'error');
        }
    });
}

// Helper function to show messages
function showMessage(element, message, type) {
    element.textContent = message;
    element.className = 'auth-message';
    
    if (type === 'success') {
        element.classList.add('success');
    } else if (type === 'error') {
        element.classList.add('error');
    }
    
    element.style.display = 'block';
}

// Check if user is already logged in - handled in the initial DOMContentLoaded function
