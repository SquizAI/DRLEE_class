// Initialize Supabase client
const SUPABASE_URL = 'https://zkiuxmgzevvgcyglecgk.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpraXV4bWd6ZXZ2Z2N5Z2xlY2drIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDQyNDAxMzYsImV4cCI6MjA1OTgxNjEzNn0.CoSia_2aZ-zj1DAfiwzuPMBojUALssUw4CUlunLDq04';

// Create the Supabase client
const supabase = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

document.addEventListener('DOMContentLoaded', async () => {
    // Check if user is logged in
    const { data } = await supabase.auth.getSession();
    const isLoggedIn = !!data.session;

    // Get user profile if logged in
    let userProfile = null;
    if (isLoggedIn) {
        const { data: profileData } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', data.session.user.id)
            .single();
        
        userProfile = profileData;
    }

    // Update UI based on login status
    updateUI(isLoggedIn, userProfile);

    // Add event listener for logout button
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', handleLogout);
    }
});

function updateUI(isLoggedIn, userProfile) {
    // Get header container
    const headerContainer = document.querySelector('header .container');
    
    // Create login/signup/profile element
    const authElement = document.createElement('div');
    authElement.className = 'auth-nav';
    
    if (isLoggedIn && userProfile) {
        // Show user profile and logout button
        authElement.innerHTML = `
            <div class="user-profile">
                <span>Welcome, ${userProfile.full_name || 'User'}</span>
                <button id="logout-btn" class="logout-btn">Logout</button>
            </div>
        `;
        
        // Remove any content restrictions
        document.querySelectorAll('.restricted-content').forEach(el => {
            el.classList.remove('restricted-content');
        });
        
    } else {
        // Show login/signup buttons
        authElement.innerHTML = `
            <a href="auth.html" class="auth-btn">Login</a>
            <a href="auth.html?tab=signup" class="auth-btn signup">Sign Up</a>
        `;
        
        // Add content restrictions
        addContentRestrictions();
    }
    
    // Add auth element to header
    headerContainer.appendChild(authElement);
}

function addContentRestrictions() {
    // Add blur effect and login prompt to algorithm cards
    const algorithmCards = document.querySelectorAll('.algorithm-card');
    
    // Execute immediately after loading
    window.addEventListener('DOMContentLoaded', () => {
        algorithmCards.forEach((card, index) => {
            // Only restrict the last two algorithms, keep first one accessible as preview
            if (index > 0) {
                // Add restricted class
                card.classList.add('restricted-content');
                
                // Create and append login prompt
                const loginPrompt = document.createElement('div');
                loginPrompt.className = 'login-prompt';
                loginPrompt.innerHTML = `
                    <p>Sign up to access this content</p>
                    <a href="auth.html?tab=signup" class="login-prompt-btn">Sign Up</a>
                `;
                
                card.appendChild(loginPrompt);
            }
        });
    });
    
    // Also add the restrictions immediately for faster loading
    algorithmCards.forEach((card, index) => {
        // Only restrict the last two algorithms, keep first one accessible as preview
        if (index > 0) {
            // Add restricted class
            card.classList.add('restricted-content');
            
            // Create and append login prompt
            const loginPrompt = document.createElement('div');
            loginPrompt.className = 'login-prompt';
            loginPrompt.innerHTML = `
                <p>Sign up to access this content</p>
                <a href="auth.html?tab=signup" class="login-prompt-btn">Sign Up</a>
            `;
            
            card.appendChild(loginPrompt);
        }
    });
}

async function handleLogout() {
    try {
        const { error } = await supabase.auth.signOut();
        if (error) throw error;
        
        // Redirect to the auth page after logout
        window.location.href = 'auth.html';
    } catch (error) {
        console.error('Error logging out:', error.message);
    }
}
