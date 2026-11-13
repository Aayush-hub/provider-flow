import { NextResponse } from 'next/server';
import { extractText } from 'unpdf';
import { createClient } from '@/lib/supabase/server';
import { extractCvCandidates } from '@/lib/cv-extraction';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user)
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const form = await request.formData(),
    file = form.get('file'),
    documentIdValue = form.get('documentId'),
    documentId =
      typeof documentIdValue === 'string' && documentIdValue
        ? documentIdValue
        : crypto.randomUUID();
  if (!(file instanceof File))
    return NextResponse.json(
      { error: 'A CV PDF is required.' },
      { status: 400 },
    );
  if (file.type !== 'application/pdf' || file.size > 10_485_760)
    return NextResponse.json(
      { error: 'Upload a text-based PDF up to 10 MB.' },
      { status: 400 },
    );
  try {
    const { text: pageTexts, totalPages } = await extractText(
        new Uint8Array(await file.arrayBuffer()),
      ),
      text = pageTexts.join('\n'),
      result = extractCvCandidates(text, documentId);
    if (!text.trim())
      return NextResponse.json(
        {
          error:
            'No selectable text was found in this PDF. Scanned-image OCR is not enabled, so please enter the information manually.',
        },
        { status: 422 },
      );
    return NextResponse.json({
      ...result,
      documentId,
      totalPages,
      source: 'Extracted locally from uploaded CV — awaiting provider review',
    });
  } catch {
    return NextResponse.json(
      {
        error:
          'We could not read this PDF. Try a text-based PDF or continue with manual entry.',
      },
      { status: 422 },
    );
  }
}
