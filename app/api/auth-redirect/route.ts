import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const target = searchParams.get("to");

  if (!target?.startsWith("http://") && !target?.startsWith("https://")) {
    return NextResponse.json(
      { error: "Invalid redirect URL" },
      { status: 400 }
    );
  }

  // Perform the redirect
  return NextResponse.redirect(target);
}
