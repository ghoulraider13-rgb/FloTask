// Quick multi-item parser probe (Feature 3 / G).
import { parseActions, parseChecklistNote } from '../src/utils/nlm.js';

const a = await parseActions('wake me at 6, 6:15 and 6:30');
console.log('1) wake me at 6, 6:15 and 6:30:');
a.forEach(x => console.log('   ->', x.type, JSON.stringify(x.title), x.dueDateTime));

const b = await parseActions('add tasks: milk, eggs, bread');
console.log('2) add tasks: milk, eggs, bread:');
b.forEach(x => console.log('   ->', x.type, JSON.stringify(x.title)));

console.log('3) grocery list:', JSON.stringify(parseChecklistNote('grocery list: milk, eggs, bread')));

const c = await parseActions('walk dog at 6am');
console.log('4) plain (unchanged):');
c.forEach(x => console.log('   ->', x.type, JSON.stringify(x.title), x.dueDateTime));
