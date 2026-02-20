import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";

const TO_EMAIL = "cathy@biphoenixtrees.com";

function getResend() {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error("RESEND_API_KEY not configured");
  return new Resend(apiKey);
}

export async function POST(request: NextRequest) {
  try {
    const resend = getResend();
    const { name, email, feedbackType, message } = await request.json();

    if (!message || typeof message !== "string" || message.trim().length === 0) {
      return NextResponse.json({ error: "Message is required" }, { status: 400 });
    }

    if (message.length > 2000) {
      return NextResponse.json({ error: "Message too long (max 2000 characters)" }, { status: 400 });
    }

    const sanitizedName = name?.trim()?.substring(0, 100) || "Anonymous";
    const sanitizedEmail = email?.trim()?.substring(0, 200) || "Not provided";
    const sanitizedType = feedbackType || "General Feedback";

    const { error } = await resend.emails.send({
      from: "Irvine Kids Resources <feedback@resend.dev>",
      to: [TO_EMAIL],
      subject: `[Feedback] ${sanitizedType} from ${sanitizedName}`,
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #6366f1;">New Feedback Received</h2>
          <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
            <tr>
              <td style="padding: 8px 12px; background: #f8f9fa; font-weight: 600; width: 120px;">Name</td>
              <td style="padding: 8px 12px;">${sanitizedName}</td>
            </tr>
            <tr>
              <td style="padding: 8px 12px; background: #f8f9fa; font-weight: 600;">Email</td>
              <td style="padding: 8px 12px;">${sanitizedEmail}</td>
            </tr>
            <tr>
              <td style="padding: 8px 12px; background: #f8f9fa; font-weight: 600;">Type</td>
              <td style="padding: 8px 12px;">${sanitizedType}</td>
            </tr>
          </table>
          <div style="padding: 16px; background: #f8f9fa; border-radius: 8px; margin-top: 16px;">
            <h3 style="margin-top: 0; color: #374151;">Message</h3>
            <p style="white-space: pre-wrap; line-height: 1.6;">${message.trim().replace(/</g, "&lt;").replace(/>/g, "&gt;")}</p>
          </div>
          <p style="color: #9ca3af; font-size: 12px; margin-top: 24px;">
            Sent from Irvine Early Kids Resources feedback form
          </p>
        </div>
      `,
      replyTo: sanitizedEmail !== "Not provided" ? sanitizedEmail : undefined,
    });

    if (error) {
      console.error("Resend error:", error);
      return NextResponse.json({ error: "Failed to send feedback" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Feedback API error:", error);
    return NextResponse.json({ error: "Failed to send feedback" }, { status: 500 });
  }
}
