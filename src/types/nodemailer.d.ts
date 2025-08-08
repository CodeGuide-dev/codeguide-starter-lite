declare module 'nodemailer' {
  export interface TransportOptions {
    host?: string;
    port?: number;
    secure?: boolean;
    auth?: {
      user: string;
      pass: string;
    };
    [key: string]: any;
  }

  export interface Transporter {
    sendMail(mailOptions: any): Promise<any>;
    verify(): Promise<void>;
  }

  export function createTransporter(options: TransportOptions): Transporter;
}