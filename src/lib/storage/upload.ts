import * as LegacyFS from 'expo-file-system/legacy';
import { supabase } from '../supabaseClient';

function guessContentType(path: string, fallback = 'application/octet-stream') {
  const ext = (path.split('.').pop() || '').toLowerCase();
  const map: Record<string, string> = {
    jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif', webp: 'image/webp', svg: 'image/svg+xml',
    mp4: 'video/mp4', mov: 'video/quicktime', m4v: 'video/x-m4v', webm: 'video/webm',
    mp3: 'audio/mpeg', wav: 'audio/wav', m4a: 'audio/mp4', aac: 'audio/aac', ogg: 'audio/ogg',
  };
  return map[ext] || fallback;
}

function base64ToUint8(base64: string) {
  const clean = base64.replace(/[\r\n\s]/g, '');
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
  let p = 0;
  const out: number[] = [];
  while (p < clean.length) {
    const enc1 = chars.indexOf(clean[p++]);
    const enc2 = chars.indexOf(clean[p++]);
    const enc3 = chars.indexOf(clean[p++]);
    const enc4 = chars.indexOf(clean[p++]);

    const chr1 = (enc1 << 2) | (enc2 >> 4);
    const chr2 = ((enc2 & 15) << 4) | (enc3 >> 2);
    const chr3 = ((enc3 & 3) << 6) | enc4;

    out.push(chr1);
    if (enc3 !== 64) out.push(chr2);
    if (enc4 !== 64) out.push(chr3);
  }
  return new Uint8Array(out);
}

function publicUrl(bucket: string, path: string) {
  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return data.publicUrl;
}

export async function uploadPublicFile(
  bucket: string,
  path: string,
  localUri: string,
  contentType?: string
): Promise<string> {
  const base64 = await LegacyFS.readAsStringAsync(localUri, { encoding: LegacyFS.EncodingType.Base64 });
  const bytes = base64ToUint8(base64);

  const ct = contentType || guessContentType(path);

  const { error } = await supabase.storage.from(bucket).upload(path, bytes, {
    upsert: true,
    contentType: ct,
    cacheControl: '3600',
  });
  if (error) throw error;

  return publicUrl(bucket, path);
}

export async function uploadStringAsFile(
  bucket: string,
  path: string,
  text: string,
  contentType = 'text/plain'
): Promise<string> {
  function strToUint8(s: string) {
    const utf8 = unescape(encodeURIComponent(s));
    const arr = new Uint8Array(utf8.length);
    for (let i = 0; i < utf8.length; i++) arr[i] = utf8.charCodeAt(i);
    return arr;
  }

  const bytes = strToUint8(text);

  const { error } = await supabase.storage.from(bucket).upload(path, bytes, {
    upsert: true,
    contentType,
    cacheControl: '3600',
  });
  if (error) throw error;

  return publicUrl(bucket, path);
}
