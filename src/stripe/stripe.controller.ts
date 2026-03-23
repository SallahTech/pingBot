import {
  Controller,
  Post,
  UseGuards,
  Request,
  Headers,
  RawBody,
  HttpCode,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { StripeService } from './stripe.service';

@Controller('stripe')
export class StripeController {
  constructor(private readonly stripeService: StripeService) {}

  @Post('create-checkout')
  @UseGuards(AuthGuard('jwt'))
  async createCheckout(
    @Request() req: { user: { id: string; email: string } },
  ) {
    const url = await this.stripeService.createCheckoutSession(
      req.user.id,
      req.user.email,
    );
    return { url };
  }

  @Post('webhook')
  @HttpCode(200)
  async handleWebhook(
    @RawBody() payload: Buffer,
    @Headers('stripe-signature') signature: string,
  ) {
    await this.stripeService.handleWebhook(payload, signature);
    return { received: true };
  }
}
