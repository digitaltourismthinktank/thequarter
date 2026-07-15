'use client';

import { useState } from 'react';
import { Badge } from '@/components/ds/Badge';
import { Button } from '@/components/ds/Button';
import { Icon } from '@/components/ds/Icon';
import { Photo } from '@/components/site/primitives';
import { RoomBooking } from '@/components/site/RoomBooking';
import { MEETING_ROOMS } from '@/lib/rooms';
import { cn } from '@/lib/cn';
import styles from './MeetingRoomsExplorer.module.css';

/* The Quarter — meeting-room explorer. Switch rooms and book inline: the same
   RoomBooking component the per-room detail pages use (live availability, the
   click-scroll-click range picker and the Stripe pay flow) sits on the right, so
   you can reserve without leaving the page. The detail pages offer fuller detail. */

export function MeetingRoomsExplorer() {
  const [roomIdx, setRoomIdx] = useState(0);
  const room = MEETING_ROOMS[roomIdx];

  return (
    <div>
      <div className={styles.switcher} role="tablist" aria-label="Choose a room">
        {MEETING_ROOMS.map((r, i) => (
          <button
            key={r.slug}
            type="button"
            role="tab"
            aria-selected={i === roomIdx}
            onClick={() => setRoomIdx(i)}
            className={cn(styles.pill, i === roomIdx && styles.pillActive)}
          >
            {r.name}
            <span className={styles.pillCap}>· {r.capacity}</span>
          </button>
        ))}
      </div>

      <div className={styles.layout}>
        <div className={styles.presentCol}>
          <Photo
            src={room.photo.src}
            alt={room.photo.alt}
            ratio="4 / 3"
            position="center 42%"
            sizes="(max-width: 940px) 100vw, 460px"
          />
          <div className={styles.presentHead}>
            <h3 className={styles.presentTitle}>{room.name}</h3>
            <Badge tone="neutral" icon="users" size="sm">
              {room.capacity}
            </Badge>
          </div>
          <p className={styles.presentBlurb}>{room.blurb}</p>
          <div className={styles.presentFeatures}>
            {room.features.map((f, i) => (
              <span key={i} className={styles.presentFeature}>
                <Icon name={f.icon} size={15} color="var(--gold-600)" />
                {f.label}
              </span>
            ))}
          </div>
          <Button variant="secondary" href={`/meeting-rooms/${room.slug}`} iconAfter="arrow-right">
            Full details &amp; gallery
          </Button>
        </div>

        <div className={styles.bookCol}>
          {/* key remounts the booker on room switch so availability + selection reset cleanly. */}
          <RoomBooking key={room.slug} roomName={room.name} price={room.price} />
        </div>
      </div>
    </div>
  );
}
