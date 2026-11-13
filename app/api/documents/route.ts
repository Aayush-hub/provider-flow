import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { ownsPrivateDocumentPath } from '@/lib/access';

const BUCKET = 'sharedcred-private';
const allowed = new Set([
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'image/png',
  'image/jpeg',
]);
const deleteSchema = z.object({
  practitionerId: z.string().uuid(),
  paths: z.array(z.string().max(500)).max(100),
});

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user)
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const form = await request.formData();
  const file = form.get('file');
  const practitionerValue = form.get('practitionerId');
  const practitionerId =
    typeof practitionerValue === 'string' ? practitionerValue : '';
  if (!(file instanceof File) || !practitionerId)
    return NextResponse.json(
      { error: 'File and practitioner are required' },
      { status: 400 },
    );
  if (!allowed.has(file.type) || file.size > 10_485_760)
    return NextResponse.json(
      { error: 'Use PDF, DOCX, PNG, or JPG files up to 10 MB' },
      { status: 400 },
    );
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const path = `users/${data.user.id}/documents/${practitionerId}/${crypto.randomUUID()}-${safeName}`;
  const admin = createAdminClient();
  const { error } = await admin.storage
    .from(BUCKET)
    .upload(path, file, { contentType: file.type, upsert: false });
  if (error)
    return NextResponse.json(
      { error: 'Unable to upload document' },
      { status: 502 },
    );
  return NextResponse.json({
    path,
    name: file.name,
    size: file.size,
    contentType: file.type,
  });
}

export async function DELETE(request: Request) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user)
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const parsed = deleteSchema.safeParse(await request.json());
  if (!parsed.success)
    return NextResponse.json(
      { error: 'Invalid delete request' },
      { status: 400 },
    );
  if (
    parsed.data.paths.some(
      (path) =>
        !ownsPrivateDocumentPath(
          data.user.id,
          parsed.data.practitionerId,
          path,
        ),
    )
  )
    return NextResponse.json(
      { error: 'Invalid document path' },
      { status: 400 },
    );
  if (parsed.data.paths.length) {
    const admin = createAdminClient();
    const { error } = await admin.storage
      .from(BUCKET)
      .remove(parsed.data.paths);
    if (error)
      return NextResponse.json(
        { error: 'Unable to remove practitioner documents' },
        { status: 502 },
      );
  }
  return NextResponse.json({ deleted: true });
}
