import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

@Injectable()
export class Msg91Service {
  private readonly logger = new Logger('EmailService');
  private transporter: nodemailer.Transporter;

  constructor(private readonly config: ConfigService) {
    this.transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: this.config.get<string>('email.user'),
        pass: this.config.get<string>('email.pass'),
      },
    });
  }

  async sendEmailOtp(email: string, otp: string, name?: string): Promise<void> {
    // Always log OTP — visible in Render logs as fallback
    this.logger.log(`OTP for ${email}: ${otp}`);

    const user = this.config.get<string>('email.user');
    if (!user) {
      this.logger.warn('GMAIL_USER not set — OTP logged only');
      return;
    }

    try {
      await this.transporter.sendMail({
        from: `"Suvidhaye" <${user}>`,
        to: email,
        subject: `Your Suvidhaye OTP: ${otp}`,
        html: `
          <div style="font-family:sans-serif;max-width:480px;margin:auto;padding:32px;background:#f9fafb;border-radius:12px">
            <div style="text-align:center;margin-bottom:24px">
              <span style="background:#1b3a4b;color:white;font-weight:900;font-size:18px;padding:8px 16px;border-radius:8px">
                Serv<span style="color:#5cb85c">Stacks</span>
              </span>
            </div>
            <h2 style="color:#1b3a4b;margin-bottom:8px">Verify your email</h2>
            <p style="color:#6b7280;margin-bottom:24px">Hi ${name || 'there'}, use this OTP to sign in:</p>
            <div style="background:#1b3a4b;color:white;font-size:40px;font-weight:900;letter-spacing:14px;text-align:center;padding:24px;border-radius:12px">
              ${otp}
            </div>
            <p style="color:#9ca3af;font-size:12px;margin-top:24px;text-align:center">
              Expires in 10 minutes. Do not share this code.
            </p>
          </div>
        `,
      });
      this.logger.log(`Email sent to ${email}`);
    } catch (err: any) {
      this.logger.error(`Email failed to ${email}: ${err?.message}`);
    }
  }
}
