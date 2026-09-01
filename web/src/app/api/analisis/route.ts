import { NextResponse } from "next/server";
import { listar } from "@/lib/analisis";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ analisis: listar() });
}
