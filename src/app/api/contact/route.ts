import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';

// Initialize Resend conditionally
const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, email, subject, message } = body;

    // Basic validation
    if (!name || !email || !message) {
      return NextResponse.json(
        { error: 'Name, email, and message are required' },
        { status: 400 }
      );
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: 'Please enter a valid email address' },
        { status: 400 }
      );
    }

    // Log the contact form submission
    console.log('📧 Contact form submission:', {
      name,
      email,
      subject,
      messageLength: message.length,
      timestamp: new Date().toISOString(),
      ip: request.headers.get('x-forwarded-for') || 'unknown'
    });

    // Send email using Resend
    if (resend) {
      try {
        const emailData = await resend.emails.send({
          from: 'contact@bigdeckenergy.org', // This will need to be configured in Resend
          to: ['help@bigdeckenergy.org'],
          subject: `Contact Form: ${subject}`,
          html: `
            <h2>New Contact Form Submission</h2>
            <p><strong>From:</strong> ${name} &lt;${email}&gt;</p>
            <p><strong>Subject:</strong> ${subject}</p>
            <p><strong>Message:</strong></p>
            <div style="background: #f5f5f5; padding: 15px; border-radius: 5px; margin: 10px 0;">
              ${message.replace(/\n/g, '<br>')}
            </div>
            <hr>
            <p style="color: #666; font-size: 12px;">
              Sent via Big Deck Energy contact form at ${new Date().toISOString()}
            </p>
          `,
          text: `New Contact Form Submission\n\nFrom: ${name} <${email}>\nSubject: ${subject}\n\nMessage:\n${message}\n\nSent via Big Deck Energy contact form at ${new Date().toISOString()}`
        });

        console.log('✅ Email sent successfully:', emailData);
      } catch (emailError) {
        console.error('❌ Failed to send email:', emailError);
        // Continue anyway - don't fail the request if email fails
      }
    } else {
      console.log('⚠️ RESEND_API_KEY not configured - email not sent');
    }

    // Return success response
    return NextResponse.json({
      success: true,
      message: 'Your message has been received. We\'ll get back to you soon!'
    });

  } catch (error) {
    console.error('Error processing contact form:', error);
    return NextResponse.json(
      { error: 'Failed to send message. Please try again.' },
      { status: 500 }
    );
  }
}