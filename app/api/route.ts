import { getDayPredictionsInRange } from "@/lib/prediction/client";
import { NextRequest } from "next/server";

// gets day predictions for a given date range and station ids
export async function GET(request: NextRequest) {
    const { searchParams } = request.nextUrl;
    const startDate = new Date(searchParams.get('startDate') ?? '');
    const endDate = new Date(searchParams.get('endDate') ?? '');
    const stationIds = searchParams.get('stationIds')?.split(',') ?? [];

    const predictions = await getDayPredictionsInRange(startDate, endDate, stationIds);

    return Response.json({ data: predictions });
}