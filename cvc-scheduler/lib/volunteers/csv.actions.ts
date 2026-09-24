"use server";
import { revalidatePath } from "next/cache";
import { createHash } from "node:crypto";
import { readVolunteerManagementRouteContext } from "./routeRead.server";
import { readCsvVolunteerProfilesWithClient } from "./server";
import { parseVolunteerCsv, matchVolunteerCsv, privateCsvFields, csvFields, type CsvField, type CsvMatch } from "./csv";
import type { Json } from "../supabase/database.types";

export type CsvPreviewRow = Omit<CsvMatch,"patch"> & { values: Record<string,string|string[]> };
export type CsvActionState = { kind:"preview"; rows:CsvPreviewRow[]; fingerprint:string } | {kind:"saved"; created:number; updated:number} | {kind:"error"; message:string};
export async function volunteerCsvAction(form: FormData): Promise<CsvActionState> {
  try {
    const context = await readVolunteerManagementRouteContext();
    if (!context?.canEdit) return {kind:"error",message:"Volunteer import is unavailable for this account."};
    const text=form.get('csv'), rawMapping=form.get('mapping');
    if(typeof text!=='string'||typeof rawMapping!=='string'||rawMapping.length>4000)throw new Error('Invalid CSV');
    const parsed=parseVolunteerCsv(text), mapping:unknown=JSON.parse(rawMapping);
    if(!Array.isArray(mapping)||mapping.length!==parsed.headers.length||mapping.some(f=>f!==''&&!csvFields.includes(f)))throw new Error('Invalid mapping');
    const profiles=await readCsvVolunteerProfilesWithClient(context.supabase,context.workspace.id);
    const rows=matchVolunteerCsv(parsed.rows,mapping as (CsvField|'')[],profiles);
    const fingerprint=createHash('sha256').update(JSON.stringify({text,mapping,rows:rows.map(r=>({row:r.row,kind:r.kind,profileId:r.profileId,version:r.version}))})).digest('hex');
    if(form.get('command')==='preview')return {kind:'preview',fingerprint,rows:rows.map(({patch,...row})=>({...row,values:Object.fromEntries(Object.entries(patch).filter(([field])=>field!=='id'&&!privateCsvFields.includes(field as typeof privateCsvFields[number])))}))};
    if(form.get('command')!=='save'||form.get('fingerprint')!==fingerprint)return {kind:'error',message:'Matching profiles changed. Review the import again.'};
    const choicesRaw=form.get('choices'), requestId=form.get('requestId');
    if(typeof choicesRaw!=='string'||choicesRaw.length>100000||typeof requestId!=='string'||!/^[0-9a-f-]{36}$/i.test(requestId))throw new Error('Invalid selection');
    const choices:unknown=JSON.parse(choicesRaw);
    if(!Array.isArray(choices)||choices.length<1||choices.length>500)throw new Error('Choose rows');
    const seen=new Set<number>();
    const patches=choices.map(choice=>{
      if(!choice||typeof choice!=='object'||!('row' in choice)||typeof choice.row!=='number'||seen.has(choice.row)||!('fields' in choice)||!Array.isArray(choice.fields))throw new Error('Invalid choice');
      seen.add(choice.row);const row=rows.find(r=>r.row===choice.row);
      if(!row||!['new','matched'].includes(row.kind)||!choice.fields.length||choice.fields.some((f: unknown)=>typeof f!=='string'||!row.fields.includes(f as CsvField)))throw new Error('Review fields first');
      const selected=row.kind==='new'?row.fields:choice.fields;
      return {profileId:row.profileId??null,expectedUpdatedAt:row.version??null,patch:Object.fromEntries(selected.map((f:CsvField)=>[f,row.patch[f]]))};
    });
    const saved=await context.supabase.rpc('import_volunteer_profiles',{p_workspace_id:context.workspace.id,p_request_id:requestId,p_rows:patches as Json});
    if(saved.error)return {kind:'error',message:saved.error.code==='40001'?'Profiles changed. Review the import again.':'Import could not be confirmed. Refresh the directory and check the result before retrying.'};
    if(!saved.data||typeof saved.data!=='object'||Array.isArray(saved.data)||typeof saved.data.created!=='number'||typeof saved.data.updated!=='number')throw new Error('Unknown result');
    try{revalidatePath('/admin/volunteers');revalidatePath('/admin/announcements');}catch{/* Imported records remain saved. */}
    return {kind:'saved',created:saved.data.created,updated:saved.data.updated};
  }catch{return {kind:'error',message:'Unable to process this CSV. Check headings, limits and field formats. If saving was interrupted, refresh the directory before retrying.'};}
}
