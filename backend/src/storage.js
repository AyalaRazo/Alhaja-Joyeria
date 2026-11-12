// Imágenes: S3 en producción (credenciales por IAM Role de la EC2), disco local en desarrollo.
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';

const bucket = process.env.S3_BUCKET;
const region = process.env.AWS_REGION || 'us-east-1';
const s3 = bucket ? new S3Client({ region }) : null;
export const UPLOAD_DIR = path.resolve('uploads');
const EXT = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp' };

export async function saveImage(file) {
  const key = `productos/${Date.now()}-${crypto.randomBytes(6).toString('hex')}${EXT[file.mimetype]}`;
  if (s3) {
    await s3.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: file.buffer, ContentType: file.mimetype, CacheControl: 'public, max-age=31536000' }));
    const base = process.env.S3_PUBLIC_URL || `https://${bucket}.s3.${region}.amazonaws.com`;
    return { url: `${base}/${key}`, key };
  }
  const dest = path.join(UPLOAD_DIR, key);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, file.buffer);
  return { url: `/uploads/${key}`, key };
}

export async function deleteImage(key) {
  if (!key) return;
  try {
    if (s3) await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
    else fs.rmSync(path.join(UPLOAD_DIR, key), { force: true });
  } catch (e) { console.error('No se pudo borrar la imagen', key, e.message); }
}
