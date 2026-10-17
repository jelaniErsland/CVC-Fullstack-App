import { readVolunteerManagementRouteContext } from "@/lib/volunteers/routeRead.server";
import { readCsvVolunteerProfilesWithClient } from "@/lib/volunteers/server";
import { exportVolunteerCsv, volunteerCsvTemplate } from "@/lib/volunteers/csv";
export async function POST(request: Request) {
  const origin=request.headers.get("origin");
  if (!origin || new URL(origin).host !== request.headers.get("host") || request.headers.get("sec-fetch-site")==="cross-site" || Number(request.headers.get("content-length") ?? 0) > 64000)
    return new Response('Unavailable', {status:403});
  const context=await readVolunteerManagementRouteContext();
  if(!context)return new Response('Unavailable',{status:403});
  const reader=request.body?.getReader();
  if(!reader)return new Response('Invalid request',{status:400});
  const chunks:Uint8Array[]=[];let bytes=0;
  while(true){const part=await reader.read();if(part.done)break;bytes+=part.value.length;if(bytes>64000){await reader.cancel();return new Response('Request too large',{status:413});}chunks.push(part.value);}
  let form:FormData;
  try{form=await new Response(Buffer.concat(chunks),{headers:{'Content-Type':request.headers.get('content-type')??''}}).formData();}
  catch{return new Response('Invalid request',{status:400});}
  const headers={'Content-Type':'text/csv; charset=utf-8','Content-Disposition':'attachment; filename="project-local-volunteers.csv"','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'};
  if(form.get('mode')==='template')return new Response(volunteerCsvTemplate(),{headers});
  const privateFields=form.get('privateFields')==='yes';
  if(privateFields&&(!context.canEdit||form.get('privateWarningAccepted')!=='yes'))return new Response('Private export unavailable',{status:403});
  try {
    const profiles=await readCsvVolunteerProfilesWithClient(context.supabase,context.workspace.id);
    const selected=form.getAll('profileIds');
    if(selected.length>500||selected.some(id=>typeof id!=='string'||!profiles.some(p=>p.id===id)))return new Response('Invalid selection',{status:400});
    const filtered=form.get('scope')==='filtered'?profiles.filter(p=>selected.includes(p.id)):profiles;
    if(filtered.length>5000)return new Response('Narrow the export selection',{status:400});
    return new Response(exportVolunteerCsv(filtered,privateFields,context.canEdit),{headers});
  }catch{return new Response('Export unavailable',{status:503,headers:{'Cache-Control':'no-store'}});}
}
