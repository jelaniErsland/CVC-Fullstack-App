import { volunteerWeekdays, type VolunteerProfile } from "./profile.ts";

export const CSV_MAX_BYTES = 512 * 1024;
export const CSV_MAX_ROWS = 500;
export const privateCsvFields = ["dateOfBirth", "emergencyContactName", "emergencyContactPhone", "emergencyContactRelationship"] as const;
export const csvFields = ["id", "fullName", "email", "phone", "congregation", "preferredContactMethod", "lifecycle", "readinessStatus", "profileNotes", "housingOption", "afterHoursSecurityAvailability", "builderAssistantCommunication", "availableWorkDays", "availableTwoPlusDays", "skillsExperience", "otherSupport", ...privateCsvFields] as const;
export type CsvField = (typeof csvFields)[number];
export type CsvProfilePatch = Partial<Record<CsvField, string | string[]>>;
const tri = new Set(["housingOption", "afterHoursSecurityAvailability", "builderAssistantCommunication", "availableTwoPlusDays"]);
const headerKey = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

export function parseVolunteerCsv(text: string): { headers: string[]; rows: string[][]; mapping: (CsvField | "")[] } {
  if (new TextEncoder().encode(text).length > CSV_MAX_BYTES || text.includes("\0")) throw new Error("CSV is too large or contains invalid text.");
  text = text.replace(/^\uFEFF/, "");
  const firstLine = text.split(/\r?\n/, 1)[0];
  const delimiter = [",", ";", "\t"].sort((a,b) => firstLine.split(b).length - firstLine.split(a).length)[0];
  const rows: string[][] = []; let row: string[] = [], cell = "", quoted = false, closed = false;
  const finishCell = () => { if (cell.length > 4000) throw new Error("A CSV field exceeds 4,000 characters."); row.push(cell); cell=""; closed=false; if(row.length>50)throw new Error("CSV has too many columns."); };
  const finishRow = () => { finishCell(); if(row.some(v=>v.trim()))rows.push(row); row=[]; if(rows.length>CSV_MAX_ROWS+1)throw new Error("Import up to 500 volunteers at a time."); };
  for(let i=0;i<text.length;i++) {
    const c=text[i];
    if(quoted) { if(c==='"') { if(text[i+1]==='"'){cell+='"';i++;} else {quoted=false;closed=true;} } else cell+=c; }
    else if(c==='"' && cell==='' && !closed) quoted=true;
    else if(c===delimiter)finishCell();
    else if(c==='\n' || c==='\r') {if(c==='\r'&&text[i+1]==='\n')i++;finishRow();}
    else if(closed || c==='"')throw new Error("CSV quotes are not balanced.");
    else cell+=c;
    if(cell.length>4000)throw new Error("A CSV field exceeds 4,000 characters.");
  }
  if(quoted)throw new Error("CSV quotes are not balanced.");
  if(cell || row.length || closed)finishRow();
  const headers=rows.shift()?.map(s=>s.trim()) ?? [];
  if(!headers.length || new Set(headers.map(headerKey)).size!==headers.length || headers.some(h=>!h))throw new Error("CSV needs distinct, non-empty column headings.");
  if(rows.some(r=>r.length!==headers.length))throw new Error("CSV rows must match the number of headings.");
  const aliases: Record<string,CsvField> = {name:"fullName",volunteerid:"id",emailaddress:"email",phonenumber:"phone",dob:"dateOfBirth",weekdays:"availableWorkDays"};
  return {headers,rows,mapping:headers.map(h=>csvFields.find(f=>headerKey(f)===headerKey(h)) ?? aliases[headerKey(h)] ?? "")};
}
function phone(value:string) {
  const cleaned=value.replace(/[() .-]/g,"");
  if(!/^\+?[0-9]{7,15}$/.test(cleaned))throw new Error("Phone must contain 7–15 digits, optionally with a country prefix.");
  return cleaned;
}
export function normalizeCsvRow(row: string[], mapping: (CsvField | "")[]): CsvProfilePatch {
  const used=mapping.filter(Boolean);if(new Set(used).size!==used.length)throw new Error("Map each profile field once.");
  const result: CsvProfilePatch={};
  for(let i=0;i<mapping.length;i++) {
    const field=mapping[i];let value=row[i]?.trim();if(!field || !value)continue;
    // Accept spreadsheet-safe phone exports, never evaluate formulas.
    if(value.startsWith("'") && /^[=+@-]/.test(value.slice(1)))value=value.slice(1);
    if(/^[=+@-]/.test(value) && !(["phone","emergencyContactPhone"].includes(field)&&/^\+?[\d ().-]+$/.test(value)))throw new Error("Formula-like CSV values are not accepted.");
    if(field==='id' && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value))throw new Error("Volunteer ID is invalid.");
    if(field==='email'){value=value.toLowerCase();if(value.length>254||! /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value))throw new Error("Email is invalid.");}
    if(field==='phone'||field==='emergencyContactPhone')value=phone(value);
    if(tri.has(field)) {
      const v=value.toLowerCase();if(['yes','y','true','1'].includes(v))value='yes';else if(['no','n','false','0'].includes(v))value='no';else if(['unknown','unsure','not sure','n/a'].includes(v))value='unknown';else throw new Error(`${field} must be yes, no or unknown.`);
    }
    if(field==='availableWorkDays'){
      const values=value.split(/[,;|]/).map(s=>s.trim().toLowerCase());
      const days=values.map(s=>volunteerWeekdays.find(d=>d.toLowerCase()===s||d.slice(0,3).toLowerCase()===s));
      if(days.some(d=>!d))throw new Error("Weekdays are invalid.");result[field]=[...new Set(days as string[])];continue;
    }
    if(field==='dateOfBirth' && (!/^\d{4}-\d{2}-\d{2}$/.test(value)||!Number.isFinite(Date.parse(value))||new Date(value).toISOString().slice(0,10)!==value||value>new Date().toISOString().slice(0,10)))throw new Error("Date of birth must be a valid YYYY-MM-DD date.");
    if(field==='preferredContactMethod'){const v=['Text','Phone','Email'].find(s=>s.toLowerCase()===value.toLowerCase());if(!v)throw new Error("Contact method must be Text, Phone or Email.");value=v;}
    if(field==='lifecycle' && !['active','inactive','archived'].includes(value.toLowerCase()))throw new Error("Lifecycle is invalid.");
    if(field==='readinessStatus' && !['ready','on_hold'].includes(value.toLowerCase()))throw new Error("Readiness is invalid.");
    if(['lifecycle','readinessStatus'].includes(field))value=value.toLowerCase();
    const max=field==='fullName'||field==='emergencyContactName'||field==='emergencyContactRelationship'?160:field==='congregation'?200:4000;
    if(value.length>max)throw new Error(`${field} is too long.`);
    result[field]=value;
  }
  return result;
}
export type CsvMatch = { row: number; kind: "new"|"matched"|"invalid"|"ambiguous"; profileId?: string; version?: string; name: string; fields: CsvField[]; patch: CsvProfilePatch; reason?: string };
export function matchVolunteerCsv(rows: string[][],mapping:(CsvField|"")[],profiles:readonly VolunteerProfile[]): CsvMatch[] {
  const seen=new Set<string>();
  return rows.map((row,index)=>{
    try {
      const patch=normalizeCsvRow(row,mapping);
      const email=typeof patch.email==='string'?patch.email:null, tel=typeof patch.phone==='string'?patch.phone.replace(/\D/g,''):null;
      const candidates=profiles.filter(p=>(patch.id && p.id===patch.id)||(email&&p.email?.trim().toLowerCase()===email)||(tel&&p.phone?.replace(/\D/g,'')===tel));
      const identifiers=[patch.id&&`id:${patch.id}`,email&&`email:${email}`,tel&&`phone:${tel}`].filter(Boolean) as string[];
      const duplicate=identifiers.some(k=>seen.has(k));identifiers.forEach(k=>seen.add(k));
      const base={row:index+2,name:typeof patch.fullName==='string'?patch.fullName:candidates[0]?.fullName??'Unnamed row',fields:Object.keys(patch).filter(k=>k!=='id') as CsvField[],patch};
      if(duplicate||candidates.length>1||(patch.id&&!profiles.some(p=>p.id===patch.id)))return {...base,kind:'ambiguous',reason:'Duplicate or conflicting identifiers; review outside this import.'};
      if(candidates.length===1)return {...base,kind:'matched',profileId:candidates[0].id,version:candidates[0].updatedAt};
      if(!patch.fullName || (!email&&!tel))return {...base,kind:'invalid',reason:'New volunteers need a name and email or phone.'};
      if(profiles.some(p=>p.fullName.trim().toLowerCase()===String(patch.fullName).toLowerCase()))return {...base,kind:'ambiguous',reason:'Name matches an existing volunteer without a reliable identifier match.'};
      return {...base,kind:'new'};
    } catch(e) {return {row:index+2,kind:'invalid',name:'Invalid row',fields:[],patch:{},reason:e instanceof Error?e.message:'Invalid row'};}
  });
}
export function spreadsheetSafeCsvCell(value: unknown) {
  let text=Array.isArray(value)?value.join('|'):value==null?'':String(value);
  if(/^[\s]*[=+@-]/.test(text)||/^[\t\r\n]/.test(text))text="'"+text;
  return '"'+text.replaceAll('"','""')+'"';
}
export function exportVolunteerCsv(profiles:readonly VolunteerProfile[],includePrivate:boolean,canEdit:boolean) {
  if(includePrivate&&!canEdit)throw new Error("Private export is unavailable.");
  const fields=csvFields.filter(f=>includePrivate||!privateCsvFields.includes(f as typeof privateCsvFields[number]));
  return '\uFEFF'+[fields.map(spreadsheetSafeCsvCell).join(','),...profiles.map(p=>fields.map(f=>spreadsheetSafeCsvCell(p[f as keyof VolunteerProfile])).join(','))].join('\r\n')+'\r\n';
}
export function volunteerCsvTemplate() {return '\uFEFF'+csvFields.map(spreadsheetSafeCsvCell).join(',')+'\r\n';}
