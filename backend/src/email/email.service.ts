import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private sesClient: SESClient | null = null;
  private fromEmail: string;

  constructor(private configService: ConfigService) {
    const region = this.configService.get<string>('AWS_REGION');
    const accessKeyId = this.configService.get<string>('AWS_ACCESS_KEY_ID');
    const secretAccessKey = this.configService.get<string>('AWS_SECRET_ACCESS_KEY');
    this.fromEmail = this.configService.get<string>('AWS_SES_FROM_EMAIL') || 'noreply@dailydigest.com';

    if (region && accessKeyId && secretAccessKey) {
      this.sesClient = new SESClient({
        region,
        credentials: {
          accessKeyId,
          secretAccessKey,
        },
      });
      this.logger.log('AWS SES client initialized');
    } else {
      this.logger.warn('AWS SES not configured - emails will be logged to console');
    }
  }

  async sendVerificationEmail(email: string, token: string, name?: string): Promise<boolean> {
    const appUrl = this.configService.get<string>('APP_URL') || 'http://localhost:3001';
    const verifyUrl = `${appUrl}/api/auth/verify-email?token=${token}`;

    const subject = 'Verify your DailyDigest account';
    const htmlBody = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 40px 20px; }
          .header { text-align: center; margin-bottom: 40px; }
          .logo { font-size: 28px; font-weight: bold; color: #667eea; }
          .button { display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: 600; margin: 20px 0; }
          .footer { margin-top: 40px; font-size: 12px; color: #666; text-align: center; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <div class="logo">📰 DailyDigest</div>
          </div>
          <h2>Welcome${name ? `, ${name}` : ''}!</h2>
          <p>Thanks for signing up for DailyDigest. Please verify your email address by clicking the button below:</p>
          <p style="text-align: center;">
            <a href="${verifyUrl}" class="button">Verify Email Address</a>
          </p>
          <p>Or copy and paste this link into your browser:</p>
          <p style="word-break: break-all; color: #667eea;">${verifyUrl}</p>
          <p>This link will expire in 24 hours.</p>
          <div class="footer">
            <p>If you didn't create an account, you can safely ignore this email.</p>
            <p>&copy; ${new Date().getFullYear()} DailyDigest. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const textBody = `
      Welcome to DailyDigest${name ? `, ${name}` : ''}!
      
      Please verify your email address by clicking the link below:
      ${verifyUrl}
      
      This link will expire in 24 hours.
      
      If you didn't create an account, you can safely ignore this email.
    `;

    return this.sendEmail(email, subject, htmlBody, textBody);
  }

  async sendWelcomeEmail(email: string, name?: string): Promise<boolean> {
    const subject = 'Welcome to DailyDigest!';
    const htmlBody = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 40px 20px; }
          .header { text-align: center; margin-bottom: 40px; }
          .logo { font-size: 28px; font-weight: bold; color: #667eea; }
          .footer { margin-top: 40px; font-size: 12px; color: #666; text-align: center; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <div class="logo">📰 DailyDigest</div>
          </div>
          <h2>Your email is verified!</h2>
          <p>Hi${name ? ` ${name}` : ''},</p>
          <p>Your DailyDigest account is now fully activated. You can now:</p>
          <ul>
            <li>📖 Read curated news from trusted sources</li>
            <li>🔖 Save articles to read later</li>
            <li>❤️ Like and share your favorite stories</li>
            <li>🎨 Customize your reading experience</li>
          </ul>
          <p>Open the app and start exploring!</p>
          <div class="footer">
            <p>&copy; ${new Date().getFullYear()} DailyDigest. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const textBody = `
      Your email is verified!
      
      Hi${name ? ` ${name}` : ''},
      
      Your DailyDigest account is now fully activated. Open the app and start exploring!
    `;

    return this.sendEmail(email, subject, htmlBody, textBody);
  }

  private async sendEmail(
    to: string,
    subject: string,
    htmlBody: string,
    textBody: string,
  ): Promise<boolean> {
    if (!this.sesClient) {
      // Log email in development mode
      this.logger.log(`[DEV EMAIL] To: ${to}`);
      this.logger.log(`[DEV EMAIL] Subject: ${subject}`);
      this.logger.log(`[DEV EMAIL] Body: ${textBody.substring(0, 200)}...`);
      return true;
    }

    try {
      const command = new SendEmailCommand({
        Source: this.fromEmail,
        Destination: {
          ToAddresses: [to],
        },
        Message: {
          Subject: {
            Data: subject,
            Charset: 'UTF-8',
          },
          Body: {
            Html: {
              Data: htmlBody,
              Charset: 'UTF-8',
            },
            Text: {
              Data: textBody,
              Charset: 'UTF-8',
            },
          },
        },
      });

      await this.sesClient.send(command);
      this.logger.log(`Email sent successfully to ${to}`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to send email to ${to}:`, error);
      return false;
    }
  }
}
