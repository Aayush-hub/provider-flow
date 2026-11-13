export function ownsPrivateDocumentPath(
  userId: string,
  practitionerId: string,
  path: string,
) {
  return path.startsWith(`users/${userId}/documents/${practitionerId}/`);
}
