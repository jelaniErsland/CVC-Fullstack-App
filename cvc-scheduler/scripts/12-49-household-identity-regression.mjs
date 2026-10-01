import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { matchVolunteerCsv } from '../lib/volunteers/csv.ts';

const id1=randomUUID(), id2=randomUUID(), outside=randomUUID();
const current=[
  {id:id1,fullName:'Avery North',email:'HOUSE@example.invalid',phone:'+12025550101',updatedAt:'2030-01-01'},
  {id:id2,fullName:'Blair North',email:'house@example.invalid',phone:'+12025550102',updatedAt:'2030-01-02'},
];
const match=(rows,mapping,profiles=current)=>matchVolunteerCsv(rows,mapping,profiles);
assert.equal(match([['Avery North','house@example.invalid']],['fullName','email'])[0].kind,'ambiguous');
assert.equal(match([['Avery North','house@example.invalid',id1]],['fullName','email','id'])[0].profileId,id1);
assert.equal(match([['Blair North','house@example.invalid',id2]],['fullName','email','id'])[0].profileId,id2);
assert.equal(match([['Casey South','house@example.invalid']],['fullName','email'])[0].kind,'new','Shared email must not imply the existing person');
assert.equal(match([['Casey South','+12025550101']],['fullName','phone'])[0].kind,'new','Shared phone must not imply the existing person');
assert.equal(match([['Casey South','house@example.invalid',outside]],['fullName','email','id'])[0].kind,'new','Unknown generated ID is not an internal match');
assert.equal(match([['Avery North','house@example.invalid',outside]],['fullName','email','id'])[0].kind,'ambiguous','Unknown ID plus possible existing person needs review');
assert.equal(match([['Avery North','house@example.invalid',id1],['Avery North','house@example.invalid',id1]],['fullName','email','id'])[1].kind,'ambiguous');
assert.equal(match([['Casey South','house@example.invalid'],['Casey South','house@example.invalid']],['fullName','email'],[])[1].kind,'ambiguous');
assert.equal(match([['Avery North','house@example.invalid',id1]],['fullName','email','id'],[])[0].kind,'new','An ID from another project cannot update this project');
assert.equal(match([['Avery North','house@example.invalid',id1]],['fullName','email','id'],current)[0].kind,'matched','Authoritative internal ID supports repeat imports');
console.log('PASS: contact sharing never authorizes a CSV update; internal IDs, generated IDs, duplicate rows, and project scope classify safely.');
