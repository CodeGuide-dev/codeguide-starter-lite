import { NextRequest, NextResponse } from 'next/server';

// 你需要将下面的测试密钥替换为你的 Stripe Secret Key
const stripeSecretKey = process.env.STRIPE_SECRET_KEY || 'sk_test_xxx';
import Stripe from 'stripe';
const stripe = new Stripe(stripeSecretKey, { apiVersion: '2024-04-10' });

export async function POST(req: NextRequest) {
  try {
    const { amount, currency } = await req.json();
    if (!amount || !currency) {
      return NextResponse.json({ error: 'Missing amount or currency' }, { status: 400 });
    }
    const paymentIntent = await stripe.paymentIntents.create({
      amount,
      currency,
    });
    return NextResponse.json({ clientSecret: paymentIntent.client_secret });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}