import * as nodemailer from 'nodemailer';
import { logger } from './logger';

export interface EmailConfig {
  host: string;
  port: number;
  secure?: boolean;
  auth?: {
    user: string;
    pass: string;
  };
}

export interface EmailTemplate {
  subject: string;
  html: string;
  text?: string;
}

export interface EmailOptions {
  to: string | string[];
  cc?: string | string[];
  bcc?: string | string[];
  subject: string;
  html?: string;
  text?: string;
  attachments?: Array<{
    filename: string;
    content: Buffer | string;
    contentType?: string;
  }>;
  priority?: 'high' | 'normal' | 'low';
  replyTo?: string;
}

export class EmailService {
  private transporter: nodemailer.Transporter;
  private from: string;

  constructor(config: EmailConfig, from: string) {
    this.from = from;
    this.transporter = nodemailer.createTransporter(config);
    
    // Verify connection on initialization
    this.verifyConnection();
  }

  private async verifyConnection(): Promise<void> {
    try {
      await this.transporter.verify();
      logger.info('Email service connection verified');
    } catch (error) {
      logger.error('Email service connection failed', { error });
    }
  }

  async sendEmail(options: EmailOptions): Promise<boolean> {
    try {
      const mailOptions = {
        from: this.from,
        to: Array.isArray(options.to) ? options.to.join(', ') : options.to,
        cc: options.cc ? (Array.isArray(options.cc) ? options.cc.join(', ') : options.cc) : undefined,
        bcc: options.bcc ? (Array.isArray(options.bcc) ? options.bcc.join(', ') : options.bcc) : undefined,
        subject: options.subject,
        html: options.html,
        text: options.text,
        attachments: options.attachments,
        priority: options.priority || 'normal',
        replyTo: options.replyTo,
      };

      const result = await this.transporter.sendMail(mailOptions);
      
      logger.info('Email sent successfully', {
        messageId: result.messageId,
        to: options.to,
        subject: options.subject,
      });

      return true;
    } catch (error) {
      logger.error('Failed to send email', {
        to: options.to,
        subject: options.subject,
        error,
      });
      return false;
    }
  }

  async sendTemplate(
    to: string | string[],
    template: EmailTemplate,
    variables: Record<string, string> = {}
  ): Promise<boolean> {
    try {
      // Replace variables in template
      let { subject, html, text } = template;
      
      Object.entries(variables).forEach(([key, value]) => {
        const placeholder = new RegExp(`{{${key}}}`, 'g');
        subject = subject.replace(placeholder, value);
        html = html.replace(placeholder, value);
        if (text) {
          text = text.replace(placeholder, value);
        }
      });

      return await this.sendEmail({
        to,
        subject,
        html,
        text,
      });
    } catch (error) {
      logger.error('Failed to send template email', { to, template: template.subject, error });
      return false;
    }
  }

  async sendBulk(emails: EmailOptions[]): Promise<{ success: number; failed: number }> {
    let success = 0;
    let failed = 0;

    for (const email of emails) {
      const result = await this.sendEmail(email);
      if (result) {
        success++;
      } else {
        failed++;
      }

      // Add small delay to avoid overwhelming the SMTP server
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    logger.info('Bulk email sending completed', { success, failed });
    return { success, failed };
  }
}

// Email templates
export const emailTemplates = {
  welcome: {
    subject: 'Welcome to CodeGuide - {{userName}}',
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { text-align: center; margin-bottom: 30px; }
            .logo { font-size: 24px; font-weight: bold; color: #2563eb; }
            .button { display: inline-block; padding: 12px 24px; background-color: #2563eb; color: white; text-decoration: none; border-radius: 6px; margin: 20px 0; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <div class="logo">CodeGuide</div>
            </div>
            <h1>Welcome, {{userName}}!</h1>
            <p>Thanks for joining CodeGuide. We're excited to help you create amazing project outlines and documentation.</p>
            <p>Here are some things you can do to get started:</p>
            <ul>
              <li>Create your first project outline</li>
              <li>Explore our template library</li>
              <li>Set up your profile preferences</li>
            </ul>
            <a href="{{dashboardUrl}}" class="button">Get Started</a>
            <p>If you have any questions, feel free to reach out to our support team.</p>
            <p>Best regards,<br>The CodeGuide Team</p>
          </div>
        </body>
      </html>
    `,
    text: `Welcome to CodeGuide, {{userName}}!

Thanks for joining CodeGuide. We're excited to help you create amazing project outlines and documentation.

Here are some things you can do to get started:
- Create your first project outline
- Explore our template library  
- Set up your profile preferences

Get started: {{dashboardUrl}}

If you have any questions, feel free to reach out to our support team.

Best regards,
The CodeGuide Team`,
  },

  passwordReset: {
    subject: 'Reset Your CodeGuide Password',
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { text-align: center; margin-bottom: 30px; }
            .logo { font-size: 24px; font-weight: bold; color: #2563eb; }
            .button { display: inline-block; padding: 12px 24px; background-color: #dc2626; color: white; text-decoration: none; border-radius: 6px; margin: 20px 0; }
            .warning { background-color: #fef2f2; border: 1px solid #fecaca; padding: 15px; border-radius: 6px; margin: 20px 0; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <div class="logo">CodeGuide</div>
            </div>
            <h1>Password Reset Request</h1>
            <p>We received a request to reset your password for your CodeGuide account.</p>
            <a href="{{resetUrl}}" class="button">Reset Password</a>
            <div class="warning">
              <p><strong>Important:</strong> This link will expire in 1 hour for security reasons.</p>
            </div>
            <p>If you didn't request a password reset, please ignore this email. Your password will remain unchanged.</p>
            <p>For security reasons, please don't share this email with anyone.</p>
            <p>Best regards,<br>The CodeGuide Team</p>
          </div>
        </body>
      </html>
    `,
    text: `Password Reset Request

We received a request to reset your password for your CodeGuide account.

Reset your password: {{resetUrl}}

Important: This link will expire in 1 hour for security reasons.

If you didn't request a password reset, please ignore this email. Your password will remain unchanged.

For security reasons, please don't share this email with anyone.

Best regards,
The CodeGuide Team`,
  },

  projectInvitation: {
    subject: '{{inviterName}} invited you to collaborate on "{{projectName}}"',
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { text-align: center; margin-bottom: 30px; }
            .logo { font-size: 24px; font-weight: bold; color: #2563eb; }
            .button { display: inline-block; padding: 12px 24px; background-color: #059669; color: white; text-decoration: none; border-radius: 6px; margin: 20px 0; }
            .project-info { background-color: #f9fafb; border: 1px solid #e5e7eb; padding: 15px; border-radius: 6px; margin: 20px 0; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <div class="logo">CodeGuide</div>
            </div>
            <h1>You're invited to collaborate!</h1>
            <p>{{inviterName}} has invited you to collaborate on their CodeGuide project.</p>
            <div class="project-info">
              <h3>{{projectName}}</h3>
              <p>{{projectDescription}}</p>
            </div>
            <p>By accepting this invitation, you'll be able to edit the project outline, add comments, and work together in real-time.</p>
            <a href="{{invitationUrl}}" class="button">Accept Invitation</a>
            <p>This invitation will expire in 7 days.</p>
            <p>Best regards,<br>The CodeGuide Team</p>
          </div>
        </body>
      </html>
    `,
    text: `You're invited to collaborate!

{{inviterName}} has invited you to collaborate on their CodeGuide project: "{{projectName}}"

{{projectDescription}}

By accepting this invitation, you'll be able to edit the project outline, add comments, and work together in real-time.

Accept invitation: {{invitationUrl}}

This invitation will expire in 7 days.

Best regards,
The CodeGuide Team`,
  },
};

// Factory function to create email service based on environment
export function createEmailService(): EmailService {
  const isDevelopment = process.env.NODE_ENV === 'development';

  if (isDevelopment) {
    // Use MailHog for local development
    return new EmailService(
      {
        host: process.env.LOCAL_SMTP_HOST || 'localhost',
        port: parseInt(process.env.LOCAL_SMTP_PORT || '1025'),
        secure: false,
      },
      process.env.SMTP_FROM || 'noreply@codeguide.local'
    );
  } else {
    // Use production SMTP settings
    return new EmailService(
      {
        host: process.env.SMTP_HOST!,
        port: parseInt(process.env.SMTP_PORT || '587'),
        secure: process.env.SMTP_PORT === '465',
        auth: {
          user: process.env.SMTP_USER!,
          pass: process.env.SMTP_PASSWORD!,
        },
      },
      process.env.SMTP_FROM!
    );
  }
}

export const emailService = createEmailService();