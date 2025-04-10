// Netlify serverless function for chat API
const { createClient } = require('@supabase/supabase-js');
const OpenAI = require('openai');
const marked = require('marked');

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || ''
});

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

exports.handler = async function(event, context) {
  // Only allow POST requests
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    // Verify OpenAI API key is available
    if (!process.env.OPENAI_API_KEY) {
      return {
        statusCode: 500,
        body: JSON.stringify({ 
          error: 'OpenAI API key is not configured', 
          details: 'Please set the OPENAI_API_KEY environment variable' 
        })
      };
    }

    // Parse request body
    const requestBody = JSON.parse(event.body);
    const { message, userId } = requestBody;

    if (!message) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Message is required' })
      };
    }

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
            title: { type: 'string' },
            message: { type: 'string' },
            actionButtons: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  text: { type: 'string' },
                  url: { type: 'string' },
                  action: { type: 'string' }
                }
              }
            }
          }
        },
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
    console.log('Netlify Function: Calling OpenAI API...');
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
    console.log('Netlify Function: OpenAI API response received');

    // Parse the AI response content
    const jsonResponse = JSON.parse(aiResponse.choices[0].message.content);
    
    // Convert markdown in the response to HTML
    if (jsonResponse.content && jsonResponse.content.message) {
      jsonResponse.content.message = marked.parse(jsonResponse.content.message);
    }

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*' // Allow requests from any domain for testing
      },
      body: JSON.stringify(jsonResponse)
    };
    
  } catch (error) {
    console.error('Error with OpenAI API:', error);
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({ 
        error: 'An error occurred while processing your request',
        details: error.message
      })
    };
  }
};
