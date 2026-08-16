// Email service for verification and password reset
// Supports: Development (console logs), Production (SendGrid/SMTP)

import nodemailer from 'nodemailer';

/**
 * Create email transporter based on environment
 */
function createTransporter() {
  // Development: Use console logging
  if (process.env.NODE_ENV === 'development' || !process.env.EMAIL_SERVICE_ENABLED) {
    return null; // Will use console logging
  }

  // Production: Use configured email service
  // Option 1: SMTP (Gmail, SendGrid, etc.)
  if (process.env.SMTP_HOST) {
    return nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_SECURE === 'true', // true for 465, false for other ports
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASSWORD,
      },
    });
  }

  // Option 2: SendGrid (if SENDGRID_API_KEY is set)
  if (process.env.SENDGRID_API_KEY) {
    return nodemailer.createTransport({
      service: 'SendGrid',
      auth: {
        user: 'apikey',
        pass: process.env.SENDGRID_API_KEY,
      },
    });
  }

  // Fallback: console logging
  return null;
}

/**
 * Send email (with fallback to console in development)
 */
async function sendEmail({ to, subject, html, text }) {
  const transporter = createTransporter();

  if (!transporter) {
    // Development mode: log to console
    console.log('\n📧 ===== EMAIL =====');
    console.log(`To: ${to}`);
    console.log(`Subject: ${subject}`);
    console.log(`Body:\n${text || html}`);
    console.log('===================\n');
    return { success: true };
  }

  try {
    const from = process.env.SMTP_FROM || process.env.EMAIL_FROM || 'noreply@local.app';
    
    await transporter.sendMail({
      from,
      to,
      subject,
      html,
      text: text || html,
    });

    console.log(`✅ Email sent to ${to}`);
    return { success: true };
  } catch (error) {
    console.error('❌ Error sending email:', error);
    // In development, fallback to console
    if (process.env.NODE_ENV === 'development') {
      console.log('\n📧 ===== EMAIL (FALLBACK) =====');
      console.log(`To: ${to}`);
      console.log(`Subject: ${subject}`);
      console.log(`Body:\n${text || html}`);
      console.log('==============================\n');
      return { success: true };
    }
    throw error;
  }
}

/**
 * Send verification email
 * @param {string} email - User email
 * @param {string} token - Verification token
 */
export async function sendVerificationEmail(email, token, code) {
  const verificationUrl = `${process.env.FRONTEND_URL || 'http://localhost:19006'}/verify-email/${token}`;
  const codeBlock = code
    ? `<p style="font-size: 28px; font-weight: bold; letter-spacing: 6px; color: #111; margin: 20px 0;">${code}</p>
       <p style="color: #666; font-size: 14px;">Enter this 6-digit code in the LOCAL app. It expires in 5 minutes.</p>`
    : '';
  const codeText = code ? `\n\nYour verification code: ${code}\n(This code expires in 5 minutes.)\n` : '';

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #D4AF37;">Welcome to LOCAL</h2>
      <p>Please verify your email address using the code below or the link:</p>
      ${codeBlock}
      <a href="${verificationUrl}" style="display: inline-block; padding: 12px 24px; background-color: #D4AF37; color: white; text-decoration: none; border-radius: 8px; margin: 16px 0;">
        Verify Email
      </a>
      <p style="color: #666; font-size: 12px; margin-top: 24px;">
        If the button doesn't work, copy and paste this link into your browser:<br/>
        <a href="${verificationUrl}">${verificationUrl}</a>
      </p>
      <p style="color: #666; font-size: 12px; margin-top: 24px;">
        This link will expire in 24 hours.
      </p>
    </div>
  `;

  const text = `Welcome to LOCAL${codeText}\n\nPlease verify your email address by visiting:\n${verificationUrl}\n\nThis link will expire in 24 hours.`;

  return await sendEmail({
    to: email,
    subject: 'Verify your LOCAL account',
    html,
    text,
  });
}

/**
 * Send password reset email
 * @param {string} email - User email
 * @param {string} token - Reset token
 */
export async function sendPasswordResetEmail(email, token) {
  const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:19006'}/reset-password/${token}`;
  
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #D4AF37;">Reset Your Password</h2>
      <p>You requested to reset your password. Click the link below to create a new password:</p>
      <a href="${resetUrl}" style="display: inline-block; padding: 12px 24px; background-color: #D4AF37; color: white; text-decoration: none; border-radius: 8px; margin: 16px 0;">
        Reset Password
      </a>
      <p style="color: #666; font-size: 12px; margin-top: 24px;">
        If the button doesn't work, copy and paste this link into your browser:<br/>
        <a href="${resetUrl}">${resetUrl}</a>
      </p>
      <p style="color: #666; font-size: 12px; margin-top: 24px;">
        If you didn't request this, please ignore this email. This link will expire in 1 hour.
      </p>
    </div>
  `;

  const text = `Reset Your Password\n\nYou requested to reset your password. Visit this link to create a new password:\n${resetUrl}\n\nIf you didn't request this, please ignore this email. This link will expire in 1 hour.`;

  return await sendEmail({
    to: email,
    subject: 'Reset your LOCAL password',
    html,
    text,
  });
}

/**
 * Send welcome email (after successful verification)
 * @param {string} email - User email
 * @param {string} name - User name
 */
export async function sendWelcomeEmail(email, name) {
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #D4AF37;">Welcome to LOCAL, ${name}!</h2>
      <p>Your account has been verified. You're all set to discover and join rituals in your city.</p>
      <p>Get started by exploring the Pulse to see what's happening near you.</p>
      <p style="color: #666; font-size: 12px; margin-top: 24px;">
        Happy ritualing! 🎉
      </p>
    </div>
  `;

  const text = `Welcome to LOCAL, ${name}!\n\nYour account has been verified. You're all set to discover and join rituals in your city.\n\nGet started by exploring the Pulse to see what's happening near you.\n\nHappy ritualing! 🎉`;

  return await sendEmail({
    to: email,
    subject: 'Welcome to LOCAL!',
    html,
    text,
  });
}

/**
 * Send announcement / broadcast email (admin)
 * @param {string} to - Recipient email
 * @param {string} subject - Subject
 * @param {string} body - Plain or HTML body
 */
export async function sendAnnouncementEmail(to, subject, body) {
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #D4AF37;">LOCAL</h2>
      <div style="margin: 16px 0; white-space: pre-wrap;">${body.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div>
      <p style="color: #666; font-size: 12px;">Bu mesaj LOCAL yönetimi tarafından gönderilmiştir.</p>
    </div>
  `;
  return await sendEmail({
    to,
    subject: subject || 'LOCAL Duyurusu',
    html,
    text: body,
  });
}
