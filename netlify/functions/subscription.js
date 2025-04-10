// Netlify serverless function for subscription API
const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

exports.handler = async function(event, context) {
  // Get user ID from the path
  const path = event.path;
  const userId = path.split('/').pop();

  if (!userId) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Missing user ID' })
    };
  }

  try {
    // Get user from Supabase
    const { data: userData, error: userError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (userError) {
      console.error('Error fetching user:', userError);
      return {
        statusCode: 404,
        body: JSON.stringify({ error: 'User not found' })
      };
    }

    // Get subscription data
    const { data: subscriptionData, error: subError } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1);

    if (subError) {
      console.error('Error fetching subscription:', subError);
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'Error fetching subscription data' })
      };
    }

    if (!subscriptionData || subscriptionData.length === 0) {
      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({ status: 'none' })
      };
    }

    // Return subscription info
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        status: subscriptionData[0].status,
        plan: subscriptionData[0].plan_id,
        currentPeriodEnd: subscriptionData[0].current_period_end
      })
    };
  } catch (error) {
    console.error('Error getting subscription status:', error);
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({ 
        error: 'Error getting subscription status',
        details: error.message
      })
    };
  }
};
