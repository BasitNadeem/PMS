import React from "react";
import { Button } from "@pms/ui";

const row: React.CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  alignItems: "center",
  gap: 12,
  padding: 20,
};

/** The four intents, at the default medium size. */
export function Variants() {
  return (
    <div style={row}>
      <Button variant="primary">Check in guest</Button>
      <Button variant="secondary">Save draft</Button>
      <Button variant="ghost">Cancel</Button>
      <Button variant="destructive">Cancel reservation</Button>
    </div>
  );
}

/** The three sizes on the primary intent. */
export function Sizes() {
  return (
    <div style={row}>
      <Button size="sm">Small</Button>
      <Button size="md">Medium</Button>
      <Button size="lg">Large</Button>
    </div>
  );
}

/** Enabled vs. disabled — disabled dims and blocks interaction. */
export function States() {
  return (
    <div style={row}>
      <Button variant="primary">Confirm booking</Button>
      <Button variant="primary" disabled>
        Confirm booking
      </Button>
      <Button variant="secondary" disabled>
        Add charge
      </Button>
    </div>
  );
}

/** A typical folio action bar — primary action paired with a ghost escape. */
export function ActionBar() {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "flex-end",
        gap: 8,
        padding: 20,
        maxWidth: 420,
      }}
    >
      <Button variant="ghost">Discard</Button>
      <Button variant="secondary">Save &amp; close</Button>
      <Button variant="primary">Post payment</Button>
    </div>
  );
}
