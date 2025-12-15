// src/lib/billing/stripe.ts
// Stripe integration for subscription billing

import Stripe from "stripe";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";

// Initialize Stripe (lazy to allow missing keys in dev)
let stripeInstance: Stripe | null = null;

function getStripe(): Stripe {
  if (!stripeInstance) {
    const apiKey = process.env.STRIPE_SECRET_KEY;
    if (!apiKey) {
      throw new Error("STRIPE_SECRET_KEY is not configured");
    }
    stripeInstance = new Stripe(apiKey, {
      apiVersion: "2024-11-20.acacia",
      typescript: true,
    });
  }
  return stripeInstance;
}

// Plan configuration
export const PLANS = {
  pausalni: {
    name: "Paušalni obrt",
    priceEur: 39,
    invoiceLimit: 50,
    userLimit: 1,
    stripePriceId: process.env.STRIPE_PRICE_PAUSALNI,
  },
  standard: {
    name: "D.O.O. Standard",
    priceEur: 99,
    invoiceLimit: 200,
    userLimit: 5,
    stripePriceId: process.env.STRIPE_PRICE_STANDARD,
  },
  pro: {
    name: "D.O.O. Pro",
    priceEur: 199,
    invoiceLimit: -1, // unlimited
    userLimit: -1, // unlimited
    stripePriceId: process.env.STRIPE_PRICE_PRO,
  },
} as const;

export type PlanId = keyof typeof PLANS;

/**
 * Create a Stripe customer for a company
 */
export async function createStripeCustomer(
  companyId: string,
  email: string,
  name: string
): Promise<string> {
  const stripe = getStripe();

  const customer = await stripe.customers.create({
    email,
    name,
    metadata: {
      companyId,
    },
  });

  await db.company.update({
    where: { id: companyId },
    data: { stripeCustomerId: customer.id },
  });

  logger.info({ companyId, customerId: customer.id }, "Stripe customer created");

  return customer.id;
}

/**
 * Create a checkout session for subscription
 */
export async function createCheckoutSession(
  companyId: string,
  planId: PlanId,
  successUrl: string,
  cancelUrl: string
): Promise<string> {
  const stripe = getStripe();
  const plan = PLANS[planId];

  if (!plan.stripePriceId) {
    throw new Error(`Stripe price ID not configured for plan: ${planId}`);
  }

  const company = await db.company.findUniqueOrThrow({
    where: { id: companyId },
    include: { users: { include: { user: true }, take: 1 } },
  });

  let customerId = company.stripeCustomerId;

  // Create customer if not exists
  if (!customerId) {
    const ownerEmail = company.users[0]?.user?.email || company.email;
    if (!ownerEmail) {
      throw new Error("No email found for company or owner");
    }
    customerId = await createStripeCustomer(companyId, ownerEmail, company.name);
  }

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: "subscription",
    payment_method_types: ["card"],
    line_items: [
      {
        price: plan.stripePriceId,
        quantity: 1,
      },
    ],
    success_url: successUrl,
    cancel_url: cancelUrl,
    metadata: {
      companyId,
      planId,
    },
    subscription_data: {
      metadata: {
        companyId,
        planId,
      },
    },
  });

  logger.info({ companyId, planId, sessionId: session.id }, "Checkout session created");

  return session.url!;
}

/**
 * Create a customer portal session for managing subscription
 */
export async function createPortalSession(
  companyId: string,
  returnUrl: string
): Promise<string> {
  const stripe = getStripe();

  const company = await db.company.findUniqueOrThrow({
    where: { id: companyId },
  });

  if (!company.stripeCustomerId) {
    throw new Error("Company does not have a Stripe customer");
  }

  const session = await stripe.billingPortal.sessions.create({
    customer: company.stripeCustomerId,
    return_url: returnUrl,
  });

  return session.url;
}

/**
 * Handle Stripe webhook events
 */
export async function handleStripeWebhook(
  body: string | Buffer,
  signature: string
): Promise<void> {
  const stripe = getStripe();
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!webhookSecret) {
    throw new Error("STRIPE_WEBHOOK_SECRET is not configured");
  }

  const event = stripe.webhooks.constructEvent(body, signature, webhookSecret);

  logger.info({ eventType: event.type }, "Stripe webhook received");

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      await handleCheckoutComplete(session);
      break;
    }
    case "customer.subscription.updated":
    case "customer.subscription.deleted": {
      const subscription = event.data.object as Stripe.Subscription;
      await syncSubscriptionStatus(subscription);
      break;
    }
    case "invoice.payment_failed": {
      const invoice = event.data.object as Stripe.Invoice;
      await handlePaymentFailed(invoice);
      break;
    }
    default:
      logger.debug({ eventType: event.type }, "Unhandled Stripe event");
  }
}

async function handleCheckoutComplete(session: Stripe.Checkout.Session): Promise<void> {
  const companyId = session.metadata?.companyId;
  const planId = session.metadata?.planId as PlanId;

  if (!companyId || !planId) {
    logger.error({ session }, "Missing metadata in checkout session");
    return;
  }

  const plan = PLANS[planId];

  await db.company.update({
    where: { id: companyId },
    data: {
      stripeSubscriptionId: session.subscription as string,
      subscriptionStatus: "active",
      subscriptionPlan: planId,
      invoiceLimit: plan.invoiceLimit,
      userLimit: plan.userLimit,
    },
  });

  logger.info({ companyId, planId }, "Subscription activated via checkout");
}

async function syncSubscriptionStatus(subscription: Stripe.Subscription): Promise<void> {
  const companyId = subscription.metadata?.companyId;

  if (!companyId) {
    // Try to find by subscription ID
    const company = await db.company.findFirst({
      where: { stripeSubscriptionId: subscription.id },
    });
    if (!company) {
      logger.error({ subscriptionId: subscription.id }, "Company not found for subscription");
      return;
    }
  }

  const updateData: Record<string, unknown> = {
    subscriptionStatus: subscription.status,
    subscriptionCurrentPeriodStart: new Date(subscription.current_period_start * 1000),
    subscriptionCurrentPeriodEnd: new Date(subscription.current_period_end * 1000),
  };

  if (subscription.status === "canceled" || subscription.status === "unpaid") {
    // Reset to free tier limits or disable features
    updateData.invoiceLimit = 5; // Very limited
    logger.warn({ subscriptionId: subscription.id, status: subscription.status }, "Subscription inactive");
  }

  await db.company.updateMany({
    where: {
      OR: [
        { stripeSubscriptionId: subscription.id },
        { id: companyId || "" },
      ],
    },
    data: updateData,
  });

  logger.info({ subscriptionId: subscription.id, status: subscription.status }, "Subscription status synced");
}

async function handlePaymentFailed(invoice: Stripe.Invoice): Promise<void> {
  const customerId = invoice.customer as string;

  const company = await db.company.findFirst({
    where: { stripeCustomerId: customerId },
  });

  if (!company) {
    logger.error({ customerId }, "Company not found for failed payment");
    return;
  }

  // TODO: Send email notification about failed payment
  logger.warn({ companyId: company.id, invoiceId: invoice.id }, "Payment failed");
}

/**
 * Check if company can create more invoices based on their plan
 */
export async function canCreateInvoice(companyId: string): Promise<boolean> {
  const company = await db.company.findUniqueOrThrow({
    where: { id: companyId },
  });

  // Unlimited plan
  if (company.invoiceLimit === -1) {
    return true;
  }

  // Check trial status
  if (company.subscriptionStatus === "trialing") {
    if (company.trialEndsAt && company.trialEndsAt < new Date()) {
      logger.warn({ companyId }, "Trial expired");
      return false;
    }
  }

  // Check subscription status
  if (company.subscriptionStatus !== "active" && company.subscriptionStatus !== "trialing") {
    logger.warn({ companyId, status: company.subscriptionStatus }, "Subscription not active");
    return false;
  }

  // Count invoices this month
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const invoiceCount = await db.eInvoice.count({
    where: {
      companyId,
      createdAt: { gte: startOfMonth },
    },
  });

  const withinLimit = invoiceCount < (company.invoiceLimit || 50);

  if (!withinLimit) {
    logger.warn({ companyId, count: invoiceCount, limit: company.invoiceLimit }, "Invoice limit reached");
  }

  return withinLimit;
}

/**
 * Get current usage for a company
 */
export async function getUsageStats(companyId: string) {
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const [company, invoiceCount, userCount] = await Promise.all([
    db.company.findUniqueOrThrow({ where: { id: companyId } }),
    db.eInvoice.count({
      where: { companyId, createdAt: { gte: startOfMonth } },
    }),
    db.companyUser.count({ where: { companyId } }),
  ]);

  return {
    plan: company.subscriptionPlan || "pausalni",
    status: company.subscriptionStatus || "trialing",
    trialEndsAt: company.trialEndsAt,
    invoices: {
      used: invoiceCount,
      limit: company.invoiceLimit || 50,
      unlimited: company.invoiceLimit === -1,
    },
    users: {
      used: userCount,
      limit: company.userLimit || 1,
      unlimited: company.userLimit === -1,
    },
  };
}
