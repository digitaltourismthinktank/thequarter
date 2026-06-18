Weekly room-availability grid — the core booking surface. Columns are days, rows are time slots, each cell carries a status. Free and held cells are selectable; booked cells are inert. Selecting a cell turns it ink with a gold tick.

```jsx
<AvailabilityCalendar
  roomName="The Hop Yard"
  days={[{label:'Mon',date:'16'},{label:'Tue',date:'17'},{label:'Wed',date:'18'},{label:'Thu',date:'19'},{label:'Fri',date:'20'}]}
  slots={['09:00','10:00','11:00','12:00','14:00','15:00','16:00']}
  data={[ ['available','busy','available','soon','available'], /* …one row per slot */ ]}
  onSelect={(s)=>console.log(s.day.label, s.slot)}
/>
```
