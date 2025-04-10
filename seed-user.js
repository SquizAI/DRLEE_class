// Script to seed a test user in Supabase
const SUPABASE_URL = 'https://zkiuxmgzevvgcyglecgk.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpraXV4bWd6ZXZ2Z2N5Z2xlY2drIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MTI3NzYxMTAsImV4cCI6MjAyODM1MjExMH0.XvpoCqqCo_jc5L1_6gxgzS5G3o8z9-PcH0HKuWdwJgI';

// Function to create the test user
async function createTestUser() {
  const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  
  try {
    // Create the user
    console.log('Creating test user...');
    const { data: authData, error: authError } = await supabaseClient.auth.signUp({
      email: 'test@test.com',
      password: 'test1234',
      options: {
        data: {
          full_name: 'Test User'
        }
      }
    });
    
    if (authError) {
      throw authError;
    }
    
    console.log('User created successfully:', authData.user.id);
    
    // Create user profile
    const { error: profileError } = await supabaseClient.from('profiles').insert([
      {
        id: authData.user.id,
        full_name: 'Test User',
        email: 'test@test.com',
        created_at: new Date().toISOString()
      }
    ]);
    
    if (profileError) {
      console.error('Error creating profile:', profileError);
      throw profileError;
    }
    
    console.log('User profile created successfully');
    alert('Test user created successfully!\nEmail: test@test.com\nPassword: test1234');
    
  } catch (error) {
    console.error('Error creating test user:', error);
    alert('Error creating test user: ' + error.message);
  }
}

// Execute the script when the button is clicked
document.getElementById('create-test-user').addEventListener('click', createTestUser);
