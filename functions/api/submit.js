// ==========================================================================
// Cloudflare Pages Function — POST /api/submit
// Relays the lead-form submission to a Telegram chat via the Bot API.
//
// Required environment variables (set in Cloudflare Pages dashboard →
// Settings → Environment variables, as encrypted "Secret" values):
//   TELEGRAM_BOT_TOKEN  — token from @BotFather
//   TELEGRAM_CHAT_ID    — numeric chat/group/channel id the bot should post to
// ==========================================================================

export async function onRequestPost(context) {
  const { request, env } = context;

  let form;
  try {
    form = await request.formData();
  } catch (err) {
    return jsonResponse({ ok: false, error: 'invalid_form_data' }, 400);
  }

  // Honeypot: a real visitor never fills this hidden field.
  const honeypot = (form.get('website') || '').toString().trim();
  if (honeypot) {
    // Pretend success so bots don't learn the honeypot was detected.
    return jsonResponse({ ok: true });
  }

  const parentName = sanitize(form.get('parentName'));
  const parentPhone = sanitize(form.get('parentPhone'));
  const childAge = sanitize(form.get('childAge'));

  if (!parentName || !parentPhone) {
    return jsonResponse({ ok: false, error: 'missing_required_fields' }, 400);
  }

  if (!env.TELEGRAM_BOT_TOKEN || !env.TELEGRAM_CHAT_ID) {
    return jsonResponse({ ok: false, error: 'server_not_configured' }, 500);
  }

  const text = [
    '🌟 <b>Новая заявка с сайта «Тропинка»</b>',
    '',
    `👤 Имя: ${escapeHtml(parentName)}`,
    `📞 Телефон: ${escapeHtml(parentPhone)}`,
    childAge ? `🎒 Возраст ребёнка: ${escapeHtml(childAge)}` : null,
  ]
    .filter(Boolean)
    .join('\n');

  const telegramUrl = `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`;

  try {
    const tgResponse = await fetch(telegramUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: env.TELEGRAM_CHAT_ID,
        text,
        parse_mode: 'HTML',
      }),
    });

    if (!tgResponse.ok) {
      const errBody = await tgResponse.text();
      console.error('Telegram API error:', errBody);
      return jsonResponse({ ok: false, error: 'telegram_delivery_failed' }, 502);
    }

    return jsonResponse({ ok: true });
  } catch (err) {
    console.error('Failed to reach Telegram API:', err);
    return jsonResponse({ ok: false, error: 'telegram_unreachable' }, 502);
  }
}

// Reject any non-POST method explicitly (Pages Functions otherwise 404 by default,
// this makes the contract explicit for anyone inspecting the endpoint).
export async function onRequestGet() {
  return jsonResponse({ ok: false, error: 'method_not_allowed' }, 405);
}

function sanitize(value) {
  if (typeof value !== 'string') return '';
  return value.trim().slice(0, 300);
}

function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function jsonResponse(body, status) {
  return new Response(JSON.stringify(body), {
    status: status || 200,
    headers: { 'Content-Type': 'application/json' },
  });
}
