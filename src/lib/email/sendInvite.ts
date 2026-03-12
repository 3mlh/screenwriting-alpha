// ── Invite email ──────────────────────────────────────────────────────────────
//
// Sends a notification email when a user is invited to collaborate.
// Uses Resend via plain fetch — no extra dependency needed.
// Set RESEND_API_KEY and RESEND_FROM in env vars.
// If either is missing, logs a warning and skips silently (dev-friendly).

export async function sendInviteEmail(params: {
  toEmail: string
  inviterName: string
  resourceType: 'project' | 'script'
  resourceTitle: string
  role: string
}): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY
  const from   = process.env.RESEND_FROM ?? 'invites@screenwriting-alpha.com'
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

  if (!apiKey) {
    console.warn('[sendInviteEmail] RESEND_API_KEY not set — skipping email')
    return
  }

  const { toEmail, inviterName, resourceType, resourceTitle, role } = params
  const subject = `${inviterName} invited you to collaborate on "${resourceTitle}"`
  const dashboardUrl = `${appUrl}/app`

  const html = `
    <p>Hi,</p>
    <p><strong>${inviterName}</strong> has invited you to collaborate on the ${resourceType}
    <strong>"${resourceTitle}"</strong> as a <strong>${role}</strong>.</p>
    <p>
      <a href="${dashboardUrl}" style="
        display:inline-block;padding:10px 20px;background:#92400e;color:white;
        border-radius:6px;text-decoration:none;font-weight:600;
      ">View invitation</a>
    </p>
    <p style="color:#888;font-size:12px;">
      Log in to Screenwriting Alpha and check your dashboard to accept or decline.
    </p>
  `

  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ from, to: toEmail, subject, html }),
  })
}
