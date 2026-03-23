import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';
import { UsersService } from '../users/users.service';
import { Plan } from '../common/enums';

@Injectable()
export class StripeService {
  private readonly logger = new Logger(StripeService.name);
  private readonly stripe: Stripe;
  private readonly webhookSecret: string;
  private readonly proPriceId: string;

  constructor(
    private readonly config: ConfigService,
    private readonly usersService: UsersService,
  ) {
    this.stripe = new Stripe(
      this.config.getOrThrow<string>('STRIPE_SECRET_KEY'),
      { apiVersion: '2026-02-25.clover' },
    );
    this.webhookSecret = this.config.getOrThrow<string>(
      'STRIPE_WEBHOOK_SECRET',
    );
    this.proPriceId = this.config.getOrThrow<string>('STRIPE_PRO_PRICE_ID');
  }

  async createCheckoutSession(userId: string, email: string): Promise<string> {
    const user = await this.usersService.findById(userId);

    let customerId = user?.stripeCustomerId;
    if (!customerId) {
      const customer = await this.stripe.customers.create({ email });
      customerId = customer.id;
      await this.usersService.update(userId, {
        stripeCustomerId: customerId,
      });
    }

    const session = await this.stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      line_items: [{ price: this.proPriceId, quantity: 1 }],
      success_url: `${this.config.get<string>('APP_URL', 'http://localhost:8080')}/stripe/success`,
      cancel_url: `${this.config.get<string>('APP_URL', 'http://localhost:8080')}/stripe/cancel`,
      metadata: { userId },
    });

    return session.url!;
  }

  async handleWebhook(payload: Buffer, signature: string): Promise<void> {
    let event: Stripe.Event;

    try {
      event = this.stripe.webhooks.constructEvent(
        payload,
        signature,
        this.webhookSecret,
      );
    } catch (error) {
      this.logger.error(`Webhook signature verification failed: ${error}`);
      throw error;
    }

    switch (event.type) {
      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription;
        if (subscription.status === 'active') {
          await this.updateUserPlan(
            subscription.customer as string,
            Plan.PRO,
          );
        }
        break;
      }
      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        await this.updateUserPlan(
          subscription.customer as string,
          Plan.FREE,
        );
        break;
      }
      default:
        this.logger.debug(`Unhandled Stripe event: ${event.type}`);
    }
  }

  private async updateUserPlan(
    stripeCustomerId: string,
    plan: Plan,
  ): Promise<void> {
    const user =
      await this.usersService.findByStripeCustomerId(stripeCustomerId);
    if (user) {
      await this.usersService.update(user.id, { plan });
      this.logger.log(`Updated user ${user.email} to ${plan} plan`);
    } else {
      this.logger.warn(
        `No user found for Stripe customer ${stripeCustomerId}`,
      );
    }
  }
}
