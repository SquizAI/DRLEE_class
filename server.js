require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { createClient } = require('@supabase/supabase-js');
const OpenAI = require('openai');
const marked = require('marked');

// Initialize OpenAI client
// Fix: Check if API key exists and provide better error handling
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || '',
  dangerouslyAllowBrowser: true, // Allow browser usage (not recommended for production)
});

// Check if OpenAI API key is configured
if (!process.env.OPENAI_API_KEY) {
  console.warn('Warning: OPENAI_API_KEY is not set in environment variables');
} else {
  console.log(`OpenAI API key detected (${process.env.OPENAI_API_KEY.substring(0, 10)}...)`); 
  // Check if using project API key format
  if (process.env.OPENAI_API_KEY.startsWith('sk-proj-')) {
    console.log('Using OpenAI project API key format');
  }
}

// Initialize Express app
const app = express();
const port = process.env.PORT || 3000;

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(express.static('.'));

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

// Routes
app.get('/api/config', (req, res) => {
  res.json({
    publishableKey: process.env.STRIPE_PUBLISHABLE_KEY,
    plans: SUBSCRIPTION_PLANS
  });
});

// Get subscription plans
app.get('/api/plans', (req, res) => {
  res.json(SUBSCRIPTION_PLANS);
});

// Create a checkout session
app.post('/api/create-checkout-session', async (req, res) => {
  const { planId, userId, userEmail } = req.body;
  
  if (!planId || !userId || !userEmail) {
    return res.status(400).json({ error: 'Missing required parameters' });
  }

  // Get the plan
  const plan = Object.values(SUBSCRIPTION_PLANS).find(p => p.id === planId);
  if (!plan) {
    return res.status(404).json({ error: 'Plan not found' });
  }

  try {
    // Create a customer if they don't exist
    let customer;
    const { data: customers, error: customerError } = await stripe.customers.list({
      email: userEmail,
      limit: 1
    });

    if (customerError) {
      return res.status(500).json({ error: customerError.message });
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
      success_url: `${process.env.APP_URL}/subscription-success.html?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.APP_URL}/subscription.html`,
      metadata: {
        userId: userId,
        planId: planId
      }
    });

    res.json({ sessionId: session.id, url: session.url });
  } catch (error) {
    console.error('Error creating checkout session:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get user subscription status
app.get('/api/subscription/:userId', async (req, res) => {
  const { userId } = req.params;
  
  if (!userId) {
    return res.status(400).json({ error: 'Missing user ID' });
  }

  try {
    // Get user from Supabase
    const { data: userData, error: userError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (userError) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Get the subscription status
    const { data: subscriptionData, error: subscriptionError } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1);

    if (subscriptionError) {
      return res.status(500).json({ error: subscriptionError.message });
    }

    if (!subscriptionData || subscriptionData.length === 0) {
      return res.json({ status: 'none' });
    }

    res.json({
      status: subscriptionData[0].status,
      plan: subscriptionData[0].plan_id,
      currentPeriodEnd: subscriptionData[0].current_period_end
    });
  } catch (error) {
    console.error('Error getting subscription status:', error);
    res.status(500).json({ error: error.message });
  }
});

// Webhook endpoint for Stripe events
app.post('/api/webhook', bodyParser.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  const webhookSecret = process.env.WEBHOOK_SECRET;

  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
  } catch (err) {
    console.error(`Webhook Error: ${err.message}`);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Handle the event
  switch (event.type) {
    case 'checkout.session.completed':
      const session = event.data.object;
      await handleCheckoutCompleted(session);
      break;
    case 'customer.subscription.updated':
      const subscription = event.data.object;
      await handleSubscriptionUpdated(subscription);
      break;
    case 'customer.subscription.deleted':
      const canceledSubscription = event.data.object;
      await handleSubscriptionCanceled(canceledSubscription);
      break;
    default:
      console.log(`Unhandled event type ${event.type}`);
  }

  res.json({ received: true });
});

// Helper functions for webhook handlers
async function handleCheckoutCompleted(session) {
  const { userId, planId } = session.metadata;
  
  try {
    // Get subscription details from Stripe
    const subscription = await stripe.subscriptions.retrieve(session.subscription);
    
    // Update Supabase
    const { error } = await supabase
      .from('subscriptions')
      .insert([
        {
          user_id: userId,
          stripe_customer_id: session.customer,
          stripe_subscription_id: session.subscription,
          plan_id: planId,
          status: subscription.status,
          current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
          current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
          created_at: new Date().toISOString()
        }
      ]);

    if (error) {
      console.error('Error saving subscription to Supabase:', error);
    }

    // Update user profile with subscription status
    const { error: profileError } = await supabase
      .from('profiles')
      .update({ 
        subscription_status: 'active',
        subscription_plan: planId
      })
      .eq('id', userId);

    if (profileError) {
      console.error('Error updating user profile:', profileError);
    }
  } catch (error) {
    console.error('Error processing checkout completion:', error);
  }
}

async function handleSubscriptionUpdated(subscription) {
  try {
    // Get the customer and find the associated user
    const customer = await stripe.customers.retrieve(subscription.customer);
    const userId = customer.metadata.userId;

    if (!userId) {
      console.error('No userId found in customer metadata');
      return;
    }

    // Update the subscription in Supabase
    const { error } = await supabase
      .from('subscriptions')
      .update({
        status: subscription.status,
        current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
        current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('stripe_subscription_id', subscription.id);

    if (error) {
      console.error('Error updating subscription in Supabase:', error);
    }

    // Update user profile with subscription status
    const { error: profileError } = await supabase
      .from('profiles')
      .update({ 
        subscription_status: subscription.status,
      })
      .eq('id', userId);

    if (profileError) {
      console.error('Error updating user profile:', profileError);
    }
  } catch (error) {
    console.error('Error processing subscription update:', error);
  }
}

async function handleSubscriptionCanceled(subscription) {
  try {
    // Get the customer and find the associated user
    const customer = await stripe.customers.retrieve(subscription.customer);
    const userId = customer.metadata.userId;

    if (!userId) {
      console.error('No userId found in customer metadata');
      return;
    }

    // Update the subscription in Supabase
    const { error } = await supabase
      .from('subscriptions')
      .update({
        status: 'canceled',
        canceled_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('stripe_subscription_id', subscription.id);

    if (error) {
      console.error('Error updating subscription in Supabase:', error);
    }

    // Update user profile with subscription status
    const { error: profileError } = await supabase
      .from('profiles')
      .update({ 
        subscription_status: 'canceled',
      })
      .eq('id', userId);

    if (profileError) {
      console.error('Error updating user profile:', profileError);
    }
  } catch (error) {
    console.error('Error processing subscription cancellation:', error);
  }
}

// Agentic AI Chat Endpoint with structured output
app.post('/api/chat', async (req, res) => {
  console.log('Chat API called with body:', req.body);
  const { message, userId } = req.body;
  
  if (!message) {
    console.log('Error: Message is required');
    return res.status(400).json({ error: 'Message is required' });
  }

  try {
    // Verify OpenAI API key is available
    if (!process.env.OPENAI_API_KEY) {
      console.error('Error: OPENAI_API_KEY is not configured');
      return res.status(500).json({ 
        error: 'OpenAI API key is not configured', 
        details: 'Please set the OPENAI_API_KEY environment variable' 
      });
    }
    
    // Log the OpenAI key status (first few chars only for security)
    const apiKeyFirstChars = process.env.OPENAI_API_KEY ? process.env.OPENAI_API_KEY.substring(0, 5) + '...' : 'not set';
    console.log(`Using OpenAI API key starting with: ${apiKeyFirstChars}`);
    console.log('OpenAI API key length:', process.env.OPENAI_API_KEY ? process.env.OPENAI_API_KEY.length : 0);

    // Define the structured output schema for different response types
    const responseSchema = {
      type: 'object',
      properties: {
        responseType: {
          type: 'string',
          enum: ['generalInfo', 'algorithmInfo', 'subscriptionInfo', 'signupProcess', 'checkout']
        },
        content: {
          type: 'object',
          properties: {
            message: { type: 'string' },
            links: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  text: { type: 'string' },
                  url: { type: 'string' }
                }
              }
            }
          },
          required: ['message']
        },
        // Only used for checkout response type
        checkoutOptions: {
          type: 'object',
          properties: {
            planId: { type: 'string' },
            planName: { type: 'string' },
            price: { type: 'number' }
          }
        },
        // Only used for algorithm info response type
        algorithmDetails: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            description: { type: 'string' },
            difficulty: { type: 'string', enum: ['beginner', 'intermediate', 'advanced'] },
            category: { type: 'string' }
          }
        }
      },
      required: ['responseType', 'content']
    };

    // Get subscription info if user is authenticated
    let subscriptionInfo = null;
    if (userId) {
      const { data: subData, error: subError } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(1);
      
      if (!subError && subData && subData.length > 0) {
        subscriptionInfo = subData[0];
      }
    }

    // Format information about the platform for the AI
    const platformInfo = {
      name: "ML Algorithms Learning Platform",
      algorithms: ["Transformers", "XGBoost", "GANs"],
      plans: [
        {
          id: "free",
          name: "Free",
          price: 0,
          features: ["Access to Transformers content only", "Basic dashboard"]
        },
        {
          id: "price_basic",
          name: "Basic",
          price: 9.99,
          features: ["Access to Transformers content", "Access to XGBoost content", "Basic progress tracking", "Email support"]
        },
        {
          id: "price_pro",
          name: "Pro",
          price: 19.99,
          features: ["Access to ALL content", "Advanced progress tracking", "Priority email support", "Monthly live Q&A sessions", "Premium resources & example code"]
        }
      ],
      userSubscription: subscriptionInfo ? {
        status: subscriptionInfo.status,
        plan: subscriptionInfo.plan_id,
        endDate: subscriptionInfo.current_period_end
      } : null
    };

    // Call the OpenAI API with the structured output format
    console.log('Calling OpenAI API...');
    const aiResponse = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `You are an AI assistant for the ML Algorithms Learning Platform, a platform for learning machine learning algorithms. 
          The platform offers courses on ${platformInfo.algorithms.join(", ")}.
          
          There are three subscription tiers:
          ${platformInfo.plans.map(plan => `- ${plan.name} ($${plan.price}): ${plan.features.join(", ")}`).join("\n")}
          
          Users can sign up for an account, log in, and subscribe to access premium content.
          
          When responding to user queries:
          1. For general questions about the platform, use responseType 'generalInfo'
          2. For questions about specific algorithms, use responseType 'algorithmInfo'
          3. For questions about subscriptions, use responseType 'subscriptionInfo'
          4. If the user wants to sign up, use responseType 'signupProcess'
          5. If the user wants to subscribe or checkout, use responseType 'checkout'
          
          Be concise, helpful, and accurate. Encourage users to sign up and subscribe to premium plans.
          Always format your response according to this JSON schema:
          {
            "responseType": "generalInfo|algorithmInfo|subscriptionInfo|signupProcess|checkout",
            "content": {
              "title": "Your title here",
              "message": "Your detailed response here",
              "actionButtons": [
                { "text": "Button text", "url": "URL to navigate to", "action": "Action description" }
              ]
            }
          }`
        },
        { role: "user", content: message }
      ],
      response_format: { type: "json_object" },
      temperature: 0.7
    });
    console.log('OpenAI API response received');

    // Parse the AI response content
    const jsonResponse = JSON.parse(aiResponse.choices[0].message.content);
    
    // Convert markdown in the response to HTML
    if (jsonResponse.content && jsonResponse.content.message) {
      jsonResponse.content.message = marked.parse(jsonResponse.content.message);
    }

    res.json(jsonResponse);
  } catch (error) {
    console.error('Error with OpenAI API:', error);
    res.status(500).json({ 
      error: 'An error occurred while processing your request',
      details: error.message
    });
  }
});

// Start the server
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
