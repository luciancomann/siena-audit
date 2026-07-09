"use client";

import { Button } from "@siena/design-system";

export function PrintButton() {
  return (
    <Button variant="secondary" size="sm" onClick={() => window.print()}>
      Print / Save PDF
    </Button>
  );
}
