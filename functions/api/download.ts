interface Env {
  CLAIM_PACK_BUCKET: R2Bucket;
  STRIPE_SECRET_KEY: string;
}

interface StripeSession {
  payment_status: string;
  status: string;
}

const NO_CACHE = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0, private',
  'Content-Type': 'text/plain; charset=utf-8',
} as const;

const MAX_FILE_BYTES = 20 * 1024 * 1024; // 20 MB ceiling

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const url = new URL(request.url);
  const sessionId = url.searchParams.get('session_id');

  if (!sessionId || !sessionId.startsWith('cs_') || sessionId.length < 20) {
    return new Response('Missing or invalid session ID.', { status: 400, headers: NO_CACHE });
  }

  // Verify payment status with Stripe API
  let session: StripeSession;
  try {
    const stripeRes = await fetch(
      `https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(sessionId)}`,
      {
        headers: {
          Authorization: `Bearer ${env.STRIPE_SECRET_KEY}`,
        },
      }
    );
    if (!stripeRes.ok) {
      return new Response('Could not verify payment. Please contact us if this continues.', {
        status: 403,
        headers: NO_CACHE,
      });
    }
    session = (await stripeRes.json()) as StripeSession;
  } catch {
    return new Response('Payment verification unavailable. Please try again shortly.', {
      status: 503,
      headers: NO_CACHE,
    });
  }

  if (session.payment_status !== 'paid') {
    return new Response('Payment not completed. Please complete your purchase first.', {
      status: 403,
      headers: NO_CACHE,
    });
  }

  // Retrieve file from R2
  const object = await env.CLAIM_PACK_BUCKET.get('section-75-claim-pack.pdf');
  if (!object) {
    return new Response('File not found. Please contact us and we will send you the file directly.', {
      status: 404,
      headers: NO_CACHE,
    });
  }

  // Sanity-check the object before serving
  if (object.size !== undefined && object.size > MAX_FILE_BYTES) {
    return new Response('File unavailable. Please contact us.', {
      status: 500,
      headers: NO_CACHE,
    });
  }

  const contentType = object.httpMetadata?.contentType ?? 'application/pdf';
  if (!contentType.includes('pdf')) {
    return new Response('File unavailable. Please contact us.', {
      status: 500,
      headers: NO_CACHE,
    });
  }

  const responseHeaders: Record<string, string> = {
    'Content-Type': contentType,
    'Content-Disposition': 'attachment; filename="section-75-claim-pack.pdf"',
    'Cache-Control': 'no-store, no-cache, must-revalidate',
    'X-Content-Type-Options': 'nosniff',
  };
  if (object.size !== undefined) {
    responseHeaders['Content-Length'] = object.size.toString();
  }

  return new Response(object.body, { headers: responseHeaders });
};
