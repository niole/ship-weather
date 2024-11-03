import { NextRequest, NextResponse } from "next/server";
import { saveDataDb } from "@/lib/import/util";

// gets day predictions for a given date range and station ids
export async function GET(request: NextRequest, response: NextResponse) {
    const { searchParams } = request.nextUrl;
    const rawStartYear = searchParams.get('startYear');
    const rawEndYear = searchParams.get('endYear');
    const stationId = searchParams.get('stationId');

    if (!rawStartYear || !rawEndYear || !stationId) {
        return Response.json({ error: 'startYear, endYear, and stationId are required' }, { status: 400 });
    }

    const startYear = Number(rawStartYear!);
    const endYear = Number(rawEndYear!);

    try {
        await saveDataDb(startYear, endYear, stationId!);
        return Response.json({ success: true });
    } catch (e) {
        return Response.json({
            error: `Error while importing data in range ${startYear}-${endYear} for station ${stationId}: ${e}`
        }, { status: 500 });
    }
}