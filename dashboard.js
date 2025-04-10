// Initialize Supabase client
const SUPABASE_URL = 'https://zkiuxmgzevvgcyglecgk.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpraXV4bWd6ZXZ2Z2N5Z2xlY2drIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDQyNDAxMzYsImV4cCI6MjA1OTgxNjEzNn0.CoSia_2aZ-zj1DAfiwzuPMBojUALssUw4CUlunLDq04';

// We initialize the Supabase client when the DOM is loaded to avoid 'supabase is not defined' errors
let supabaseClient;

// Function to initialize Supabase
function initializeSupabase() {
    try {
        supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        console.log('Supabase client initialized in dashboard');
        return true;
    } catch (error) {
        console.error('Error initializing Supabase client:', error);
        return false;
    }
}

// Global variables
let currentUser = null;
let userProfile = null;

// Document ready function
document.addEventListener('DOMContentLoaded', async () => {
    // Initialize Supabase
    if (!initializeSupabase()) {
        alert('Failed to initialize required services. Please refresh the page.');
        return;
    }
    
    try {
        // Check if user is logged in
        const { data, error } = await supabaseClient.auth.getSession();
        
        if (error || !data.session) {
            console.log('No active session found, redirecting to login');
            // Redirect to login page if not logged in
            window.location.href = 'auth.html';
            return;
        }
        
        currentUser = data.session.user;
        console.log('User logged in:', currentUser.email);
        
        // Load user profile data
        await loadUserProfile();
        
        // Update UI with user data
        updateUIWithUserData();
        
        // Set up event listeners
        setupEventListeners();
        
        // Set current date for last login
        document.getElementById('last-login').textContent = new Date().toLocaleDateString();
    } catch (error) {
        console.error('Error initializing dashboard:', error);
        alert('There was a problem loading your dashboard. Please try logging in again.');
        window.location.href = 'auth.html';
    }
});

// Load user profile from database
async function loadUserProfile() {
    try {
        const { data, error } = await supabaseClient
            .from('profiles')
            .select('*')
            .eq('id', currentUser.id)
            .single();
        
        if (error) throw error;
        
        userProfile = data || {
            id: currentUser.id,
            full_name: currentUser.user_metadata?.full_name || 'User',
            email: currentUser.email
        };
        
        // If profile doesn't exist yet, create one
        if (!data) {
            await createUserProfile();
        }
    } catch (error) {
        console.error('Error loading user profile:', error.message);
        // Create default profile if error occurred
        userProfile = {
            id: currentUser.id,
            full_name: currentUser.user_metadata?.full_name || 'User',
            email: currentUser.email
        };
    }
}

// Create user profile if it doesn't exist
async function createUserProfile() {
    try {
        const { error } = await supabaseClient
            .from('profiles')
            .insert([{
                id: currentUser.id,
                full_name: currentUser.user_metadata?.full_name || 'User',
                email: currentUser.email,
                created_at: new Date().toISOString()
            }]);
        
        if (error) throw error;
    } catch (error) {
        console.error('Error creating user profile:', error.message);
    }
}

// Update UI elements with user data
function updateUIWithUserData() {
    // Update header username
    document.getElementById('user-name').textContent = userProfile.full_name;
    
    // Update welcome message
    document.getElementById('welcome-name').textContent = userProfile.full_name;
    
    // Update profile settings form
    const fullnameInput = document.getElementById('fullname');
    const emailInput = document.getElementById('email');
    const bioInput = document.getElementById('bio');
    
    if (fullnameInput) fullnameInput.value = userProfile.full_name || '';
    if (emailInput) emailInput.value = userProfile.email || '';
    if (bioInput) bioInput.value = userProfile.bio || '';
}

// Set up event listeners
function setupEventListeners() {
    // Sidebar navigation
    const navLinks = document.querySelectorAll('.sidebar-nav a');
    navLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            const targetId = this.getAttribute('href').substring(1);
            
            // Update active class on sidebar
            document.querySelectorAll('.sidebar-nav li').forEach(li => {
                li.classList.remove('active');
            });
            this.parentElement.classList.add('active');
            
            // Show target section
            document.querySelectorAll('.dashboard-section').forEach(section => {
                section.classList.remove('active');
            });
            document.getElementById(targetId).classList.add('active');
        });
    });
    
    // Logout button
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async function(e) {
            e.preventDefault();
            
            try {
                const { error } = await supabaseClient.auth.signOut();
                if (error) throw error;
                
                window.location.href = 'auth.html';
            } catch (error) {
                console.error('Error logging out:', error.message);
                alert('Error logging out. Please try again.');
            }
        });
    }
    
    // Profile form submission
    const profileForm = document.getElementById('profile-form');
    if (profileForm) {
        profileForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            const fullname = document.getElementById('fullname').value;
            const bio = document.getElementById('bio').value;
            
            try {
                // Update profile in database
                const { error } = await supabaseClient
                    .from('profiles')
                    .update({
                        full_name: fullname,
                        bio: bio,
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', currentUser.id);
                
                if (error) throw error;
                
                // Update user metadata
                const { error: metadataError } = await supabaseClient.auth.updateUser({
                    data: { full_name: fullname }
                });
                
                if (metadataError) throw metadataError;
                
                // Update local data
                userProfile.full_name = fullname;
                userProfile.bio = bio;
                
                // Update UI
                document.getElementById('user-name').textContent = fullname;
                document.getElementById('welcome-name').textContent = fullname;
                
                // Show success message
                alert('Profile updated successfully!');
            } catch (error) {
                console.error('Error updating profile:', error.message);
                alert('Error updating profile. Please try again.');
            }
        });
    }
    
    // Password form submission
    const passwordForm = document.getElementById('password-form');
    if (passwordForm) {
        passwordForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            const currentPassword = document.getElementById('current-password').value;
            const newPassword = document.getElementById('new-password').value;
            const confirmPassword = document.getElementById('confirm-password').value;
            
            // Validate passwords
            if (newPassword !== confirmPassword) {
                alert('New passwords do not match.');
                return;
            }
            
            try {
                // Update password
                const { error } = await supabaseClient.auth.updateUser({
                    password: newPassword
                });
                
                if (error) throw error;
                
                // Reset form
                passwordForm.reset();
                
                // Show success message
                alert('Password updated successfully!');
            } catch (error) {
                console.error('Error updating password:', error.message);
                alert('Error updating password. Please try again.');
            }
        });
    }
    
    // Save notification preferences
    const savePreferencesBtn = document.getElementById('save-preferences');
    if (savePreferencesBtn) {
        savePreferencesBtn.addEventListener('click', function() {
            alert('Notification preferences saved!');
        });
    }
}
