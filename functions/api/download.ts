interface Env {
  CLAIM_PACK_BUCKET: R2Bucket;
  STRIPE_SECRET_KEY: string;
}

interface StripeSession {
  payment_status: string;
  status: string;
}

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const url = new URL(request.url);
  const sessionId = url.searchParams.get('session_id');

  // Basic validation — Stripe session IDs always start with cs_
  if (!sessionId || !sessionId.startsWith('cs_')) {
    return new Response('Missing or invalid session ID.', { status: 400 });
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
      });
    }
    session = (await stripeRes.json()) as StripeSession;
  } catch {
    return new Response('Payment verification unavailable. Please try again shortly.', {
      status: 503,
    });
  }

  if (session.payment_status !== 'paid') {
    return new Response('Payment not completed. Please complete your purchase first.', {
      status: 403,
    });
  }

  // Retrieve file from R2
  const object = await env.CLAIM_PACK_BUCKET.get('section-75-claim-pack.pdf');
  if (!object) {
    return new Response('File not found. Please contact us and we will send you the file directly.', {
      status: 404,
    });
  }

  return new Response(object.body, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': 'attachment; filename="section-75-claim-pack.pdf"',
      'Cache-Control': 'no-store, no-cache, must-revalidate',
    },
  });
};
