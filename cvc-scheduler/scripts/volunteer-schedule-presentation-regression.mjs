import assert from 'node:assert/strict';
import {groupScheduleByStartDate,sameDayShiftLabel} from '../lib/volunteerSchedulePresentation.ts';

const item=(id,startDate,startTime,endTime,endDate=null)=>({id,startDate,startTime,endTime,endDate});
const morning=item('morning','2026-10-23','07:30','12:00');
const afternoon=item('afternoon','2026-10-23','12:30','17:00');
const overnight=item('overnight','2026-10-24','22:00','06:00','2026-10-25');
const adjacent=item('adjacent','2026-10-25','22:00','06:00','2026-10-26');
const source=[morning,afternoon,overnight,adjacent];
const groups=groupScheduleByStartDate(source);
assert.deepEqual(groups.map(group=>[group.date,group.assignments.map(assignment=>assignment.id)]),[
  ['2026-10-23',['morning','afternoon']],
  ['2026-10-24',['overnight']],
  ['2026-10-25',['adjacent']],
]);
assert.equal(source.length,4,'Grouping must not mutate assignment data.');
assert.equal(sameDayShiftLabel(morning,2),'Morning');
assert.equal(sameDayShiftLabel(afternoon,2),'Afternoon');
assert.equal(sameDayShiftLabel(item('evening','2026-10-23','18:00','22:00'),2),'Evening');
assert.equal(sameDayShiftLabel(overnight,2),'Overnight');
assert.equal(sameDayShiftLabel(morning,1),null);
assert.equal(sameDayShiftLabel(item('full','2026-10-23','07:30','17:00'),2),null,'Full-day work has no unambiguous shift label.');
assert.equal(sameDayShiftLabel(item('untimed','2026-10-23',null,null),2),null);
console.log('Volunteer schedule grouping and unambiguous shift labels passed.');
