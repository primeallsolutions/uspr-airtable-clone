// Placeholder e-signature requests collection route; replace with real implementation when ready.
import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({ error: "E-signature requests list not implemented" }, { status: 501 });
}

export async function POST() {
  return NextResponse.json({ error: "E-signature request creation not implemented" }, { status: 501 });
}
