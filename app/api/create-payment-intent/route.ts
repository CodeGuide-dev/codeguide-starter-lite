import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';

// List of Stripe-supported ISO currency codes (2024, uppercased for validation)
const SUPPORTED_CURRENCIES = [
  'USD','AED','AFN','ALL','AMD','ANG','AOA','ARS','AUD','AWG','AZN','BAM','BBD','BDT','BGN','BIF','BMD','BND','BOB','BRL','BSD','BWP','BYN','BZD','CAD','CDF','CHF','CLP','CNY','COP','CRC','CVE','CZK','DJF','DKK','DOP','DZD','EGP','ETB','EUR','FJD','FKP','GBP','GEL','GIP','GMD','GNF','GTQ','GYD','HKD','HNL','HTG','HUF','IDR','ILS','INR','ISK','JMD','JPY','KES','KGS','KHR','KMF','KRW','KYD','KZT','LAK','LBP','LKR','LRD','LSL','MAD','MDL','MGA','MKD','MMK','MNT','MOP','MUR','MVR','MWK','MXN','MYR','MZN','NAD','NGN','NIO','NOK','NPR','NZD','PAB','PEN','PGK','PHP','PKR','PLN','PYG','QAR','RON','RSD','RUB','RWF','SAR','SBD','SCR','SEK','SGD','SHP','SLE','SOS','SRD','STD','SZL','THB','TJS','TOP','TRY','TTD','TWD','TZS','UAH','UGX','UYU','UZS','VND','VUV','WST','XAF','XCD','XCG','XOF','XPF','YER','ZAR','ZMW'
];

export async function POST(req: NextRequest) {
  try {
    // Move Stripe key check and initialization here
    const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
    if (!stripeSecretKey) {
      return NextResponse.json({ error: 'STRIPE_SECRET_KEY environment variable is required' }, { status: 500 });
    }
    const stripe = new Stripe(stripeSecretKey, { apiVersion: '2024-04-10' });

    const { amount, currency } = await req.json();
    // Validate amount
    if (
      typeof amount !== 'number' ||
      !Number.isInteger(amount) ||
      amount <= 0
    ) {
      return NextResponse.json({ error: 'Amount must be a positive integer' }, { status: 400 });
    }
    // Validate currency (case-insensitive)
    if (
      typeof currency !== 'string' ||
      !SUPPORTED_CURRENCIES.includes(currency.toUpperCase())
    ) {
      return NextResponse.json({ error: 'Invalid or unsupported currency code' }, { status: 400 });
    }
    const paymentIntent = await stripe.paymentIntents.create({
      amount,
      currency: currency.toLowerCase(), // Stripe expects lowercase
    });
    return NextResponse.json({ clientSecret: paymentIntent.client_secret });
  } catch (error: any) {
    // Handle malformed JSON and Stripe errors
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}