// Netlify serverless function for creating checkout sessions
const { createClient } = require('@supabase/supabase-js');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

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
  // Only allow POST requests
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    // Parse request body
    const requestBody = JSON.parse(event.body);
    const { planId, userId, userEmail } = requestBody;
    
    console.log(`Creating checkout session for plan: ${planId}, user: ${userId}`);
    
    if (!planId || !userId || !userEmail) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Missing required parameters' })
      };
    }

    // Get the plan
    const plan = Object.values(SUBSCRIPTION_PLANS).find(p => p.id === planId);
    if (!plan) {
      return {
        statusCode: 404,
        body: JSON.stringify({ error: 'Plan not found' })
      };
    }

    // Create a customer if they don't exist
    let customer;
    const { data: customers, error: customerError } = await stripe.customers.list({
      email: userEmail,
      limit: 1
    });

    if (customerError) {
      return {
        statusCode: 500,
        body: JSON.stringify({ error: customerError.message })
      };
    }

    if (customers.length === 0) {
      // Create a new customer
      customer = await stripe.customers.create({
        email: userEmail,
        metadata: {
          userId: userId
        }
      });
    } else {
      customer = customers[0];
    }

    // Create a checkout session
    const session = await stripe.checkout.sessions.create({
      customer: customer.id,
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: plan.name,
              description: plan.features.join(', ')
            },
            unit_amount: Math.round(plan.price * 100), // Stripe uses cents
            recurring: {
              interval: 'month'
            }
          },
          quantity: 1
        }
      ],
      mode: 'subscription',
      success_url: `${process.env.APP_URL || 'https://drlee-class.netlify.app'}/subscription-success.html?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.APP_URL || 'https://drlee-class.netlify.app'}/subscription.html`,
      metadata: {
        userId: userId,
        planId: planId
      }
    });

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({ sessionId: session.id, url: session.url })
    };
  } catch (error) {
    console.error('Error creating checkout session:', error);
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({ 
        error: 'Error creating checkout session',
        details: error.message
      })
    };
  }
};
