import React from "react";
import { Badge } from "@pms/ui";

const row: React.CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  alignItems: "center",
  gap: 10,
  padding: 20,
};

/** All five tones, each carrying a fixed semantic meaning. */
export function Variants() {
  return (
    <div style={row}>
      <Badge variant="default">Draft</Badge>
      <Badge variant="success">Paid</Badge>
      <Badge variant="warning">Pending</Badge>
      <Badge variant="danger">Overdue</Badge>
      <Badge variant="info">In house</Badge>
    </div>
  );
}

/** How the tones map to reservation lifecycle states in the PMS. */
export function ReservationStatuses() {
  return (
    <div style={row}>
      <Badge variant="info">Confirmed</Badge>
      <Badge variant="warning">Tentative</Badge>
      <Badge variant="success">Checked in</Badge>
      <Badge variant="default">Checked out</Badge>
      <Badge variant="danger">No show</Badge>
    </div>
  );
}

/** Inline within a row of text, as they appear in tables and folios. */
export function Inline() {
  return (
    <div style={{ padding: 20, fontSize: 14, lineHeight: "28px", maxWidth: 460 }}>
      <div>
        Room 214 &mdash; A. Okafor <Badge variant="success">Checked in</Badge>
      </div>
      <div>
        Folio #10473 balance <Badge variant="danger">Overdue</Badge>
      </div>
      <div>
        Group block &ldquo;Delta Corp&rdquo; <Badge variant="warning">Pending</Badge>
      </div>
    </div>
  );
}
