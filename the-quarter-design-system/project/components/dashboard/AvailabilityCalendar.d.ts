import * as React from 'react';

export interface CalendarDay { label: string; date?: string; }
export type SlotStatus = 'available' | 'busy' | 'soon';

export interface AvailabilitySelection {
  day: CalendarDay; slot: string; dayIndex: number; slotIndex: number; status: SlotStatus;
}

export interface AvailabilityCalendarProps {
  /** Column headers, e.g. [{label:'Mon',date:'16'}, …]. */
  days: CalendarDay[];
  /** Row time labels, e.g. ['09:00','10:00', …]. */
  slots: string[];
  /** Status matrix indexed [slotIndex][dayIndex]; defaults to 'available'. */
  data: SlotStatus[][];
  /** Title shown above the grid. */
  roomName?: string;
  /** Controlled selected cell key "dayIndex-slotIndex". */
  selectedKey?: string;
  onSelect?: (sel: AvailabilitySelection) => void;
  style?: React.CSSProperties;
}

/**
 * Weekly room-availability grid — glanceable, tappable, calm. Free cells are
 * selectable; booked cells are inert. The Quarter's biggest revenue lever.
 * @startingPoint section="Dashboard" subtitle="Weekly availability grid" viewport="700x420"
 */
export function AvailabilityCalendar(props: AvailabilityCalendarProps): JSX.Element;
