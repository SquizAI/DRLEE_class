// Netlify serverless function for config API
const { createClient } = require('@supabase/supabase-js');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

// Define subscription plans
const SUBSCRIPTION_PLANS = {
  basic: {
    id: process.env.BASIC_PLAN_PRICE_ID || 'price_basic',
    name: 'Basic Plan',
    price: 9.99,
    features: [
      'Access to Transformers and XGBoost materials',
      'Basic progress tracking',
      'Email support'
    ]
  },
  pro: {
    id: process.env.PRO_PLAN_PRICE_ID || 'price_pro',
    name: 'Pro Plan',
    price: 19.99,
    features: [
      'Access to all ML algorithm materials',
      'Advanced progress tracking',
      'Priority email support',
      'Monthly live Q&A sessions'
    ]
  }
};

exports.handler = async function(event, context) {
  // Only allow GET requests
  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    // Return Stripe publishable key and plans
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*' // Allow requests from any domain for testing
      },
      body: JSON.stringify({
        publishableKey: process.env.STRIPE_PUBLISHABLE_KEY,
        plans: SUBSCRIPTION_PLANS
      })
    };
  } catch (error) {
    console.error('Error in config function:', error);
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({ 
        error: 'An error occurred while fetching configuration',
        details: error.message
      })
    };
  }
};
