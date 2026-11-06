/**
 * Shape of a file from Multer memoryStorage.
 * Declared explicitly so the build does not depend on Express.Multer namespace merging
 * (breaks with @types/express v5 + "moduleResolution": "nodenext" without extra references).
 */
export interface UploadedAudioFile {
  fieldname: string;
  originalname: string;
  encoding: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}
