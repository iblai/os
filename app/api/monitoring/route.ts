import { NextRequest } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const envelope = await request.text();

    if (!envelope || envelope.trim() === '') {
      return new Response('Empty envelope', { status: 400 });
    }

    const piece = envelope.split('\n')[0];

    if (!piece || piece.trim() === '') {
      return new Response('Invalid envelope format', { status: 400 });
    }

    let header;
    try {
      header = JSON.parse(piece);
    } catch (parseError) {
      console.error('Failed to parse Sentry envelope header:', parseError);
      return new Response('Invalid JSON in envelope header', { status: 400 });
    }
    const dsn = new URL(header.dsn);
    const projectId = dsn.pathname.replace('/', '');
    const sentryIngestURL = `https://sentry.ibl.network/api/${projectId}/envelope/`;

    return await fetch(sentryIngestURL, {
      method: 'POST',
      body: envelope,
      headers: {
        'Content-Type': 'application/x-sentry-envelope',
      },
    });
  } catch (e) {
    console.error('Error forwarding to Sentry:', e);
    return new Response('Bad Request', { status: 400 });
  }
}
