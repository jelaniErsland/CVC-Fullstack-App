import assert from 'node:assert/strict';
import sharp from 'sharp';
import {encodeProjectPhoto,localPhotoStorageEnabled} from '../lib/projectPhoto/files.server.ts';
import {parseProjectPhoto,projectPhotoUrl} from '../lib/projectPhoto/photo.ts';

assert(localPhotoStorageEnabled({NEXT_PUBLIC_SUPABASE_URL:'http://127.0.0.1:54321'}));
assert(!localPhotoStorageEnabled({NEXT_PUBLIC_SUPABASE_URL:'https://example.supabase.co'}));
assert(!localPhotoStorageEnabled({NEXT_PUBLIC_SUPABASE_URL:'http://127.0.0.1:54321',VERCEL:'1'}));
const input=await sharp({create:{width:1800,height:1000,channels:3,background:'#6d815b'}}).jpeg().withMetadata().toBuffer();
const images=await encodeProjectPhoto(input);
for(const size of ['desktop','mobile']){
  const meta=await sharp(images[size]).metadata();
  assert.equal(meta.format,'webp');assert.equal(meta.exif,undefined);assert.equal(meta.icc,undefined);
  assert(meta.width<=(size==='desktop'?1600:780));
}
await assert.rejects(()=>encodeProjectPhoto(Buffer.from('<svg/>')));
await assert.rejects(()=>encodeProjectPhoto(Buffer.alloc(7*1024*1024)));
const id='22222222-2222-4222-8222-222222222222';
const photo=parseProjectPhoto({asset_id:id,version:2,desktop_x:55,desktop_y:50,mobile_x:65,mobile_y:45,uploads_enabled:true});
assert.equal(photo.version,2);
assert.equal(projectPhotoUrl(id,'desktop'),`/v/project-photo/${id}/desktop`);
assert.equal(projectPhotoUrl(id,'mobile'),`/v/project-photo/${id}/mobile`);
assert.throws(()=>parseProjectPhoto({...photo,mobile_x:101}));
console.log('PASS: existing photo input validation, stripped responsive WebP derivatives, crop/version parsing, protected URL shape and local-only upload boundary. No database or authenticated session used.');
